/**
 * TOEIC 题库唯一范围定义（P0）
 * 当前正式范围：Set 6–16、Part 2–5、Test 1–2。
 * 本模块不迁移/删除旧缓存；旧版 setN_testN_data 仅保留为历史备份，不再自动读取。
 */
(() => {
  const SET_MIN = 6, SET_MAX = 16;
  const PART_IDS = Object.freeze([2, 3, 4, 5]);
  const TEST_IDS = Object.freeze([1, 2]);
  const CACHE_NAMESPACE = 'toeic_scope_v1';
  const asInt = value => Number.isInteger(Number(value)) ? Number(value) : NaN;
  const isSetId = value => { const n = asInt(value); return n >= SET_MIN && n <= SET_MAX; };
  const isPartId = value => PART_IDS.includes(asInt(value));
  const isTestId = value => TEST_IDS.includes(asInt(value));
  const assertSet = value => { if (!isSetId(value)) throw new Error(`当前题库范围仅允许 Set 6–16（收到：${value}）`); return Number(value); };
  const assertPart = value => { if (!isPartId(value)) throw new Error(`当前题库范围仅允许 Part 2–5（收到：${value}）`); return Number(value); };
  const assertTest = value => { if (!isTestId(value)) throw new Error(`Test 编号仅允许 1 或 2（收到：${value}）`); return Number(value); };
  const cacheKey = (setId, testId = 1) => `${CACHE_NAMESPACE}:set${assertSet(setId)}:test${assertTest(testId)}:questions`;
  const readCache = (setId, testId = 1) => {
    try { return JSON.parse(localStorage.getItem(cacheKey(setId, testId)) || '{}'); }
    catch (error) { console.warn('新题库缓存解析失败，将使用空缓存：', error); return {}; }
  };
  const writeCache = (setId, testId, data) => {
    const safe = {};
    Object.values(data || {}).forEach(q => {
      if (!q?.questionId || !isPartId(q.partId)) return;
      safe[String(q.questionId)] = { ...q, setId: Number(setId), testId: Number(testId), partId: Number(q.partId) };
    });
    localStorage.setItem(cacheKey(setId, testId), JSON.stringify(safe));
    return safe;
  };
  const filterParts = parts => (Array.isArray(parts) ? parts : [])
    .filter(part => isPartId(part.partId))
    .map(part => ({ ...part, questions: (part.questions || []).filter(q => isPartId(q.partId ?? part.partId)) }));
  const isQuestionAllowed = q => !!q && isSetId(q.setId) && isTestId(q.testId || 1) && isPartId(q.partId);
  window.QuestionScope = Object.freeze({
    setMin: SET_MIN, setMax: SET_MAX, setIds: Object.freeze(Array.from({length: SET_MAX-SET_MIN+1}, (_,i)=>SET_MIN+i)),
    partIds: PART_IDS, testIds: TEST_IDS, cacheNamespace: CACHE_NAMESPACE,
    isSetId, isPartId, isTestId, assertSet, assertPart, assertTest, cacheKey, readCache, writeCache, filterParts, isQuestionAllowed
  });
})();
