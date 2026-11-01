// PRD 3.1：每支手機在本機記住預設成員
const STORAGE_KEY = 'diet:default-member-id'

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  }
  catch {
    return null
  }
}

export function useCurrentMember() {
  const memberId = useState<string | null>('current-member-id', () => readStored())

  function setDefaultMember(id: string | null) {
    memberId.value = id
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id)
      else localStorage.removeItem(STORAGE_KEY)
    }
    catch {
      // 私密瀏覽等情況下 localStorage 可能不可用，只保留記憶體中的值
    }
  }

  return { memberId, setDefaultMember }
}
