"""把食藥署「食品營養成分資料庫」開放資料轉成 foods / food_portions 的 seed migration。

資料來源：衛生福利部食品藥物管理署 食品營養成分資料庫（政府資料開放授權條款第 1 版）
下載：https://data.fda.gov.tw/opendata/exportDataList.do?method=ExportData&InfoId=20&logType=2

用法：python3 scripts/build_tfda_seed.py 20_2.csv > supabase/migrations/0003_tfda_foods.sql
"""
import csv
import re
import sys
from collections import OrderedDict, defaultdict

NUTRIENTS = {
    'kcal': ('修正熱量', '熱量'),
    'protein_g': ('粗蛋白',),
    'carbs_g': ('總碳水化合物',),
    'fat_g': ('粗脂肪',),
}

# 同一種食物在不同月份／年份取樣的重複資料，合併成一筆平均
SAMPLING_TAG = re.compile(r'\((\d{1,2}月|\d{4}年)取樣\)')

# 常見食物的常用單位（整合編號 → [(單位, 克數)]）
CURATED_PORTIONS = {
    'A0550601': [('1 碗', 200), ('半碗', 100)],  # 白飯
}

LIQUID_CATEGORIES = {'飲料類'}
LIQUID_NAME = re.compile(r'鮮乳|保久乳|乳飲品|調味乳|豆漿|豆奶|優酪乳|發酵乳|燕麥奶')
NOT_LIQUID_NAME = re.compile(r'粉|凝態')
SPOON_CATEGORIES = {'油脂類', '調味料及香辛料類'}


def num(value: str) -> float:
    value = (value or '').strip()
    try:
        return float(value)
    except ValueError:
        return 0.0


def sql_str(value: str | None) -> str:
    if value is None or value == '':
        return 'null'
    return "'" + value.replace("'", "''") + "'"


def sample_state(description: str) -> str:
    m = re.search(r'樣品狀態:([^;]*)', description)
    return m.group(1).strip() if m else ''


def load(path: str):
    foods: OrderedDict[str, dict] = OrderedDict()
    for row in csv.DictReader(open(path, encoding='utf-8-sig')):
        code = row['整合編號']
        food = foods.get(code)
        if food is None:
            food = foods[code] = {
                'code': code,
                'name': row['樣品名稱'].strip(),
                'aliases': row['俗名'].strip(),
                'category': row['食品分類'].strip(),
                'description': sample_state(row['內容物描述']),
                'is_average': row['資料類別'] == '樣品平均值',
                'unit_grams': num(row['每單位重'].replace('克', '')),
                'values': {},
            }
        if row['分析項分類'] == '一般成分':
            food['values'][row['分析項']] = num(row['每100克含量'])
    return list(foods.values())


def nutrients_of(food: dict) -> dict:
    out = {}
    for key, names in NUTRIENTS.items():
        out[key] = next((food['values'][n] for n in names if food['values'].get(n)), 0.0)
    return out


def build(path: str) -> tuple[list[dict], list[tuple[str, str, float]]]:
    groups: dict[str, list[dict]] = defaultdict(list)
    for food in load(path):
        name = food['name']
        if food['is_average']:
            # 「芒果平均值(西洋種)」→「芒果(平均,西洋種)」
            m = re.match(r'(.+?)平均值(?:\((.+)\))?$', name)
            if m:
                name = f"{m.group(1)}(平均{',' + m.group(2) if m.group(2) else ''})"
        else:
            name = SAMPLING_TAG.sub('', name).strip()
        groups[name].append(food)

    foods, portions = [], []
    for name, members in groups.items():
        first = members[0]
        values = [nutrients_of(f) for f in members]
        merged = {k: round(sum(v[k] for v in values) / len(values), 1) for k in NUTRIENTS}
        unit_weights = [f['unit_grams'] for f in members if f['unit_grams'] > 0]
        aliases = ','.join(OrderedDict.fromkeys(
            a.strip() for f in members for a in f['aliases'].split(',') if a.strip() and a.strip() != name
        ))
        foods.append({
            'code': first['code'],
            'name': name,
            'aliases': aliases,
            'category': first['category'],
            'description': first['description'],
            **merged,
        })

        code = first['code']
        for label, grams in CURATED_PORTIONS.get(code, []):
            portions.append((code, label, grams))
        is_liquid = first['category'] in LIQUID_CATEGORIES or (
            LIQUID_NAME.search(name) and not NOT_LIQUID_NAME.search(name)
        )
        if is_liquid:
            portions.append((code, '1 杯', 240))
        elif first['category'] in SPOON_CATEGORIES:
            portions.append((code, '1 湯匙', 15))
            portions.append((code, '1 茶匙', 5))
        elif unit_weights and code not in CURATED_PORTIONS:
            grams = round(sum(unit_weights) / len(unit_weights))
            # 整顆高麗菜、整顆西瓜這類單位重沒有參考價值
            if grams <= 600:
                portions.append((code, '1 個', grams))
    return foods, portions


def main():
    foods, portions = build(sys.argv[1])
    out = sys.stdout
    out.write('-- 食藥署「食品營養成分資料庫」官方食物（由 scripts/build_tfda_seed.py 產生，請勿手動修改）\n')
    out.write('-- 資料來源：衛生福利部食品藥物管理署，政府資料開放授權條款第 1 版\n')
    out.write(f'-- {len(foods)} 項食物、{len(portions)} 個常用單位；需先執行 0002_foods.sql\n\n')
    out.write('begin;\n\n')
    out.write("delete from foods where source = 'tfda';\n\n")

    cols = 'source, source_code, name, aliases, category, description, base_label, base_grams, kcal, protein_g, carbs_g, fat_g'
    for i in range(0, len(foods), 500):
        out.write(f'insert into foods ({cols}) values\n')
        rows = []
        for f in foods[i:i + 500]:
            rows.append(
                f"('tfda', {sql_str(f['code'])}, {sql_str(f['name'])}, {sql_str(f['aliases'])}, "
                f"{sql_str(f['category'])}, {sql_str(f['description'])}, '100g', 100, "
                f"{f['kcal']}, {f['protein_g']}, {f['carbs_g']}, {f['fat_g']})"
            )
        out.write(',\n'.join(rows) + ';\n\n')

    out.write('insert into food_portions (food_id, label, grams)\n')
    out.write('select f.id, v.label, v.grams from (values\n')
    out.write(',\n'.join(f'  ({sql_str(c)}, {sql_str(l)}, {g})' for c, l, g in portions))
    out.write("\n) as v (code, label, grams)\njoin foods f on f.source = 'tfda' and f.source_code = v.code;\n\n")
    out.write('commit;\n')


if __name__ == '__main__':
    main()
