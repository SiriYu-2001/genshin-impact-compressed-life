const roles = {
  setup: ['开端', '#4f9188'],
  development: ['发展', '#3f7f9a'],
  investigation: ['探查', '#796aa0'],
  conflict: ['冲突', '#a66557'],
  revelation: ['揭示', '#b07b35'],
  climax: ['高潮', '#9b4e4e'],
  resolution: ['收束', '#4d8061'],
  transition: ['过渡', '#77817f'],
}

const questTypes = {
  all: { label: '全部', short: '全部', color: '#9eb9b3' },
  aq: { label: '魔神任务', short: '魔神', color: '#d3a45b' },
  lq: { label: '传说任务', short: '传说', color: '#9b7fbd' },
  eq: { label: '活动任务', short: '活动', color: '#c66f64' },
  wq: { label: '世界任务', short: '世界', color: '#5f9d87' },
  iq: { label: '委托任务', short: '委托', color: '#6c91b8' },
  hq: { label: '邀约事件', short: '邀约', color: '#b77c9d' },
  other: { label: '其他任务', short: '其他', color: '#858f8d' },
}
const questTypeOrder = ['aq', 'lq', 'eq', 'wq', 'iq', 'hq', 'other']

function questTypeOf(scene) {
  return questTypes[scene.quest_type] ? scene.quest_type : 'other'
}

const dom = {
  search: document.querySelector('#scene-search'),
  typeFilters: document.querySelector('#type-filters'),
  stats: document.querySelector('#catalog-stats'),
  list: document.querySelector('#scene-list'),
  loading: document.querySelector('#loading-view'),
  empty: document.querySelector('#empty-view'),
  error: document.querySelector('#error-view'),
  errorMessage: document.querySelector('#error-message'),
  story: document.querySelector('#story-view'),
  menuButton: document.querySelector('#menu-button'),
  scrim: document.querySelector('#sidebar-scrim'),
}

const state = { index: [], links: {}, linkNodes: {}, selected: null, bundle: null, activeType: 'aq' }

function element(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function replaceChildren(selector, ...children) {
  document.querySelector(selector).replaceChildren(...children)
}

function setText(selector, text) {
  document.querySelector(selector).textContent = text ?? ''
}

function showView(view) {
  for (const node of [dom.loading, dom.empty, dom.error, dom.story]) node.hidden = node !== view
}

function closeMenu() {
  document.body.classList.remove('menu-open')
  dom.scrim.hidden = true
}

function visibleScenes(query = '') {
  const needle = query.trim().toLocaleLowerCase('zh-CN')
  return state.index.filter((scene) => {
    if (state.activeType !== 'all' && questTypeOf(scene) !== state.activeType) return false
    if (!needle) return true
    return [
      scene.scene_id,
      scene.title,
      scene.full_title,
      scene.chapter_num,
      scene.chapter_image_title,
      scene.route,
      questTypes[questTypeOf(scene)].label,
      ...(scene.themes ?? []),
    ].join(' ').toLocaleLowerCase('zh-CN').includes(needle)
  })
}

function renderTypeFilters() {
  const counts = new Map(questTypeOrder.map((type) => [type, 0]))
  for (const scene of state.index) counts.set(questTypeOf(scene), (counts.get(questTypeOf(scene)) ?? 0) + 1)
  const fragment = document.createDocumentFragment()
  for (const type of ['all', ...questTypeOrder]) {
    const count = type === 'all' ? state.index.length : counts.get(type) ?? 0
    if (type !== 'all' && count === 0 && !['aq', 'lq', 'eq', 'wq', 'iq'].includes(type)) continue
    const config = questTypes[type]
    const button = element('button', `type-filter${state.activeType === type ? ' active' : ''}`)
    button.type = 'button'
    button.style.setProperty('--type-color', config.color)
    button.append(element('span', '', config.short), element('small', '', String(count)))
    button.title = config.label
    button.addEventListener('click', () => {
      state.activeType = type
      renderTypeFilters()
      renderSceneList()
    })
    fragment.append(button)
  }
  dom.typeFilters.replaceChildren(fragment)
}

function renderSceneList() {
  const scenes = visibleScenes(dom.search.value)
  const totalChapters = state.index.reduce((sum, scene) => sum + scene.chapter_count, 0)
  const totalSections = state.index.reduce((sum, scene) => sum + scene.section_count, 0)
  dom.stats.textContent = `${scenes.length} / ${state.index.length} scenes · ${totalChapters} chapters · ${totalSections} sections`
  const fragment = document.createDocumentFragment()
  const types = state.activeType === 'all' ? questTypeOrder : [state.activeType]
  for (const type of types) {
    const grouped = scenes.filter((scene) => questTypeOf(scene) === type)
    if (grouped.length === 0) continue
    const groupHeader = element('div', 'scene-group-header')
    groupHeader.style.setProperty('--type-color', questTypes[type].color)
    groupHeader.append(element('span', '', questTypes[type].label), element('small', '', String(grouped.length)))
    fragment.append(groupHeader)
    for (const scene of grouped) {
      const button = element('button', `scene-link${scene.scene_id === state.selected ? ' active' : ''}`)
      button.type = 'button'
      button.dataset.sceneId = scene.scene_id
      button.style.setProperty('--type-color', questTypes[type].color)
      button.append(element('span', 'scene-link-id', String(scene.scene_id)))
      const copy = element('span', 'scene-link-copy')
      if (scene.chapter_num) copy.append(element('span', 'scene-link-chapter', scene.chapter_num))
      copy.append(element('strong', '', scene.title || '未命名任务'))
      const origin = scene.chapter_image_title || questTypes[type].label
      copy.append(element('small', '', `${origin} · ${scene.chapter_count} 章 · ${scene.section_count} 节`))
      button.append(copy)
      button.addEventListener('click', () => selectScene(scene.scene_id))
      fragment.append(button)
    }
  }
  if (scenes.length === 0) fragment.append(element('p', 'catalog-stats', '没有匹配的 scene'))
  dom.list.replaceChildren(fragment)
}

function chip(text) { return element('span', 'chip', text) }

function renderMetrics(bundle) {
  const metrics = [
    ['Chapters', bundle.chapters.length],
    ['Sections', bundle.sections.length],
    ['Context', bundle.context_refs.length],
  ]
  const fragment = document.createDocumentFragment()
  for (const [label, value] of metrics) {
    const wrapper = element('div', 'metric')
    wrapper.append(element('dt', '', label), element('dd', '', String(value)))
    fragment.append(wrapper)
  }
  replaceChildren('#scene-metrics', fragment)
}

function renderContinuity(sceneId) {
  const card = document.querySelector('#continuity-card')
  const note = document.querySelector('#scene-resolution-note')
  const continuation = state.links[String(sceneId)]?.continuation ?? []
  card.hidden = continuation.length === 0
  note.hidden = continuation.length === 0
  if (continuation.length === 0) {
    replaceChildren('#continuity-list')
    return
  }

  const fragment = document.createDocumentFragment()
  for (const relationship of continuation) {
    const followup = { ...(state.linkNodes[String(relationship.scene_id)] ?? {}), ...relationship }
    const item = element('article', 'continuity-item')
    const header = element('div', 'continuity-item-head')
    const copy = element('div', 'continuity-title')
    copy.append(element('span', '', followup.distance === 1 ? '直接承接' : `后续第 ${followup.distance} 篇`))
    copy.append(element('h4', '', followup.full_title || followup.title))
    const relation = element('span', `continuity-relation confidence-${followup.confidence}`, followup.relation_label)
    header.append(copy, relation)
    item.append(header, element('p', '', followup.resolution))
    const button = element('button', 'continuity-link', '查看这篇剧情 →')
    button.type = 'button'
    button.addEventListener('click', () => selectScene(followup.scene_id))
    item.append(button)
    fragment.append(item)
  }
  replaceChildren('#continuity-list', fragment)
}

function contextMap(bundle) {
  return new Map(bundle.context_refs.map((ref) => [ref.id, ref]))
}

function inlineContext(ids, refs) {
  if (!ids?.length) return null
  const wrapper = element('div', 'context-inline')
  wrapper.append(element('strong', '', '补充语境 · '))
  wrapper.append(document.createTextNode(ids.map((id) => refs.get(id)?.fact).filter(Boolean).join('；')))
  return wrapper
}

function renderSection(section, refs) {
  const [roleName, color] = roles[section.narrative_role] ?? [section.narrative_role, '#4f9188']
  const card = element('article', `section-card${section.is_hidden ? ' is-hidden' : ''}`)
  card.style.setProperty('--role-color', color)
  const main = element('div', 'section-card-main')
  const top = element('div', 'section-topline')
  const role = element('span', 'role-badge')
  role.append(element('i', 'role-dot'), document.createTextNode(roleName))
  const importance = element('span', 'importance')
  importance.title = `剧情重要度 ${section.importance}/5`
  for (let index = 1; index <= 5; index += 1) importance.append(element('i', index <= section.importance ? 'on' : ''))
  top.append(role, importance)
  main.append(top, element('h5', '', section.title))

  const meta = element('div', 'section-meta')
  meta.append(element('span', '', `◷ ${section.when}`))
  meta.append(element('span', '', `⌖ ${section.locations.join(' · ')}`))
  if (section.characters.length) meta.append(element('span', '', `◎ ${section.characters.join(' · ')}`))
  main.append(meta, element('p', 'section-summary', section.summary))

  const causal = element('div', 'causal-grid')
  for (const [label, value] of [['动机', section.motivation], ['影响', section.outcome]]) {
    const item = element('div', 'causal-item')
    item.append(element('b', '', label), document.createTextNode(value))
    causal.append(item)
  }
  main.append(causal)
  const chips = element('div', 'chip-row section-chips')
  for (const keyword of section.keywords) chips.append(chip(keyword))
  main.append(chips)
  const context = inlineContext(section.context_ref_ids, refs)
  if (context) main.append(context)
  card.append(main)

  const details = element('details', 'source-details')
  details.append(element('summary', '', `源剧情步骤 · ${section.source_steps.length}`))
  const steps = element('div', 'source-steps')
  for (const step of section.source_steps) {
    const row = element('div', 'source-step')
    row.append(element('code', '', step.key), element('span', '', step.title || '未命名步骤'))
    if (step.is_hidden) row.append(element('em', '', '隐藏'))
    steps.append(row)
  }
  details.append(steps)
  card.append(details)
  return card
}

function renderChapter(chapter, sections, refs) {
  const block = element('article', 'chapter-block')
  block.id = `chapter-${chapter.chapter_index}`
  block.append(element('div', 'chapter-marker', String(chapter.chapter_index + 1).padStart(2, '0')))
  const head = element('header', 'chapter-head')
  const titleLine = element('div', 'chapter-title-line')
  titleLine.append(element('h4', '', chapter.title))
  if (chapter.is_hidden) titleLine.append(element('span', 'hidden-badge', '隐藏 / 测试'))
  head.append(titleLine, element('p', 'chapter-summary', chapter.summary))
  const facts = element('div', 'chapter-facts')
  for (const [label, value] of [['转折', chapter.turning_point], ['结果', chapter.outcome]]) {
    const fact = element('div', 'chapter-fact')
    fact.append(element('strong', '', `${label} · `), document.createTextNode(value))
    facts.append(fact)
  }
  head.append(facts)
  const context = inlineContext(chapter.context_ref_ids, refs)
  if (context) head.append(context)
  block.append(head)
  const list = element('div', 'section-list')
  for (const section of sections) list.append(renderSection(section, refs))
  block.append(list)
  return block
}

function renderBundle(bundle) {
  const refs = contextMap(bundle)
  const indexEntry = state.index.find((scene) => scene.scene_id === bundle.scene.scene_id) ?? {}
  const type = questTypeOf(indexEntry)
  setText('#scene-number', `SCENE ${bundle.scene.scene_id}`)
  setText('#quest-type-badge', questTypes[type].label)
  document.querySelector('#quest-type-badge').style.setProperty('--type-color', questTypes[type].color)
  setText('#chapter-number', indexEntry.chapter_num ?? bundle.scene.chapter_num)
  setText('#region-name', indexEntry.chapter_image_title ?? '')
  setText('#scene-title', indexEntry.title || bundle.scene.title)
  document.title = `${indexEntry.full_title || bundle.scene.title} · Amber Story Atlas`
  setText('#scene-premise', bundle.scene.premise)
  setText('#scene-conflict', bundle.scene.central_conflict)
  setText('#scene-summary', bundle.scene.summary)
  setText('#scene-resolution', bundle.scene.resolution)
  renderContinuity(bundle.scene.scene_id)
  replaceChildren('#scene-themes', ...bundle.scene.themes.map(chip))
  renderMetrics(bundle)

  const tabs = document.createDocumentFragment()
  const timeline = document.createDocumentFragment()
  for (const chapter of bundle.chapters) {
    const tab = element('button', 'chapter-tab')
    tab.type = 'button'
    tab.append(element('span', '', String(chapter.chapter_index + 1).padStart(2, '0')), document.createTextNode(chapter.title))
    tab.addEventListener('click', () => document.querySelector(`#chapter-${chapter.chapter_index}`).scrollIntoView())
    tabs.append(tab)
    timeline.append(renderChapter(
      chapter,
      bundle.sections.filter((section) => section.chapter_index === chapter.chapter_index).sort((a, b) => a.order - b.order),
      refs,
    ))
  }
  replaceChildren('#chapter-tabs', tabs)
  replaceChildren('#chapter-timeline', timeline)

  const contextPanel = document.querySelector('#context-panel')
  contextPanel.hidden = bundle.context_refs.length === 0
  const contextList = document.createDocumentFragment()
  for (const ref of bundle.context_refs) {
    const card = element('article', 'context-ref')
    const header = element('header')
    header.append(element('code', '', ref.id), element('span', 'context-path', ref.path))
    card.append(header, element('p', '', ref.reason), element('p', '', ref.fact))
    contextList.append(card)
  }
  replaceChildren('#context-list', contextList)
  const date = new Date(bundle.generated.at)
  setText('#generated-at', `生成于 ${Number.isNaN(date.valueOf()) ? bundle.generated.at : date.toLocaleString('zh-CN')}`)
}

async function selectScene(sceneId, updateHash = true) {
  const scene = state.index.find((item) => item.scene_id === Number(sceneId))
  if (!scene) return
  if (state.activeType !== 'all' && questTypeOf(scene) !== state.activeType) {
    state.activeType = questTypeOf(scene)
    renderTypeFilters()
  }
  state.selected = scene.scene_id
  renderSceneList()
  closeMenu()
  showView(dom.loading)
  try {
    const response = await fetch(scene.data_path, { cache: 'no-store' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    state.bundle = await response.json()
    renderBundle(state.bundle)
    showView(dom.story)
    if (updateHash) history.replaceState(null, '', `#scene=${scene.scene_id}`)
    window.scrollTo({ top: 0 })
  } catch (error) {
    dom.errorMessage.textContent = `无法读取 ${scene.data_path}：${error.message}`
    showView(dom.error)
  }
}

async function boot() {
  try {
    const [response, links] = await Promise.all([
      fetch('data/index.json', { cache: 'no-store' }),
      fetch('data/story-links.json', { cache: 'no-store' })
        .then((linksResponse) => linksResponse.ok ? linksResponse.json() : { scenes: {} })
        .catch(() => ({ scenes: {} })),
    ])
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const index = await response.json()
    state.index = index.scenes ?? []
    state.links = links.scenes ?? {}
    state.linkNodes = links.nodes ?? {}
    const requested = Number(new URLSearchParams(location.hash.slice(1)).get('scene'))
    const requestedScene = state.index.find((scene) => scene.scene_id === requested)
    if (requestedScene) state.activeType = questTypeOf(requestedScene)
    else if (!state.index.some((scene) => questTypeOf(scene) === state.activeType)) state.activeType = 'all'
    renderTypeFilters()
    renderSceneList()
    if (state.index.length === 0) {
      showView(dom.empty)
      return
    }
    const initial = state.index.some((scene) => scene.scene_id === requested)
      ? requested
      : (visibleScenes('')[0]?.scene_id ?? state.index[0].scene_id)
    await selectScene(initial, requested !== initial)
  } catch (error) {
    dom.errorMessage.textContent = `无法读取剧情索引：${error.message}`
    showView(dom.error)
  }
}

dom.search.addEventListener('input', renderSceneList)
dom.menuButton.addEventListener('click', () => {
  document.body.classList.toggle('menu-open')
  dom.scrim.hidden = !document.body.classList.contains('menu-open')
})
dom.scrim.addEventListener('click', closeMenu)
window.addEventListener('hashchange', () => {
  const requested = Number(new URLSearchParams(location.hash.slice(1)).get('scene'))
  if (requested && requested !== state.selected) selectScene(requested, false)
})
window.addEventListener('keydown', (event) => {
  if (event.key === '/' && document.activeElement !== dom.search) {
    event.preventDefault()
    dom.search.focus()
  }
})

window.__amberReady = boot()
