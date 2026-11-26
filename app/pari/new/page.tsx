'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { browserClient } from '../../client'
import { PariHeader } from '../header'

type Format = 'binary' | 'multi' | 'free'
type Draft = { name: string; condition: string }
type Option = { id: string; label: string }
const formats: { id: Format; symbol: string; name: string; description: string }[] = [
  { id:'binary', symbol:'☑', name:'Да / Нет', description:'Событие на определённую дату' },
  { id:'multi', symbol:'☷', name:'Варианты ответа', description:'Собственный список ответов' },
  { id:'free', symbol:'✎', name:'Свободный ответ', description:'Участники вводят ответы сами' }
]
const emptyDrafts = (): Record<Format,Draft> => ({ binary:{name:'',condition:''}, multi:{name:'',condition:''}, free:{name:'',condition:''} })
const emptyOptions = (): Option[] => [{id:crypto.randomUUID(),label:''},{id:crypto.randomUUID(),label:''}]
const displayDate = (value: string) => value ? value.split('-').reverse().join('.') : 'Не указано'

export default function NewPariPage() {
  const router = useRouter()
  const [format,setFormat] = useState<Format>('binary')
  const [drafts,setDrafts] = useState<Record<Format,Draft>>(emptyDrafts)
  const [options,setOptions] = useState<Option[]>(emptyOptions)
  const [eventDate,setEventDate] = useState('')
  const [deadlineDate,setDeadlineDate] = useState('')
  const [deadlineTime,setDeadlineTime] = useState('')
  const [hidden,setHidden] = useState(true)
  const [demoAnswer,setDemoAnswer] = useState('')
  const [demoSent,setDemoSent] = useState(false)
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [timezone,setTimezone] = useState('UTC')
  useEffect(() => { const timer = setTimeout(() => setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'), 0); return () => clearTimeout(timer) }, [])
  const draft = drafts[format]
  const currentFormat = formats.find(item => item.id === format)!
  const changeDraft = (key: keyof Draft,value: string) => { setDrafts(current => ({...current,[format]:{...current[format],[key]:value}})); setError('') }
  const changeFormat = (value: Format) => { setFormat(value); setDemoAnswer(''); setDemoSent(false); setError('') }
  const optionLabels = options.map(option => option.label.trim())
  function validation() {
    if (!draft.name.trim() || !draft.condition.trim()) return 'Заполните название и условия.'
    if (draft.name.trim().length > 160 || draft.condition.trim().length > 2000) return 'Название или условия слишком длинные.'
    if (!deadlineDate || !deadlineTime) return 'Укажите дату и время дедлайна.'
    const deadline = new Date(`${deadlineDate}T${deadlineTime}`)
    if (Number.isNaN(deadline.valueOf()) || deadline <= new Date()) return 'Дедлайн должен быть в будущем.'
    if (format === 'binary' && (!eventDate || deadlineDate > eventDate)) return 'Дедлайн не может быть позже даты события.'
    if (format === 'multi' && (options.length < 2 || options.length > 20 || optionLabels.some(label => !label || label.length > 160) || new Set(optionLabels.map(label => label.toLocaleLowerCase())).size !== options.length)) return 'Укажите от 2 до 20 неповторяющихся вариантов.'
    return ''
  }
  function reset() {
    if ((Object.values(drafts).some(item => item.name || item.condition) || options.some(item => item.label) || eventDate || deadlineDate || deadlineTime || demoAnswer) && !window.confirm('Сбросить введённые данные?')) return
    setFormat('binary');setDrafts(emptyDrafts());setOptions(emptyOptions());setEventDate('');setDeadlineDate('');setDeadlineTime('');setHidden(true);setDemoAnswer('');setDemoSent(false);setError('')
  }
  async function create() {
    if (busy) return
    const problem = validation()
    if (problem) { setError(problem); return }
    setBusy(true);setError('')
    try {
      const {data,error: failure} = await browserClient().rpc('create_pari',{p_type:format,p_title:draft.name.trim(),p_condition:draft.condition.trim(),p_event_date:format==='binary'?eventDate:null,p_deadline_at:new Date(`${deadlineDate}T${deadlineTime}`).toISOString(),p_timezone:timezone,p_hidden_answers:hidden,p_options:format==='multi'?optionLabels:[]})
      if (failure) throw failure
      router.push(`/pari/${data}`)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось создать пари. Проверьте вход и повторите попытку.') }
    finally { setBusy(false) }
  }
  return <><PariHeader/><main><small>Пари / Создание пари</small><h1>Создание пари</h1><p className="muted">Настройте условия и формат участия.</p>
    <div className="layout"><section className="panel"><h2>01. Формат пари</h2>
      {formats.map(item => <button type="button" key={item.id} className={`type ${format===item.id?'active':''}`} aria-pressed={format===item.id} onClick={() => changeFormat(item.id)}><span className="symbol" aria-hidden="true">{item.symbol}</span><span><strong>{item.name}</strong><small>{item.description}</small></span><span className="mark" aria-hidden="true">{format===item.id?'◉':'○'}</span></button>)}
      <hr/><h2>02. Условия пари</h2><label htmlFor="pari-name">Название</label><input id="pari-name" maxLength={160} value={draft.name} onChange={event => changeDraft('name',event.target.value)}/>
      <label htmlFor="pari-condition">Условия</label><textarea id="pari-condition" maxLength={2000} value={draft.condition} onChange={event => changeDraft('condition',event.target.value)}/>
      {format==='binary' && <><label htmlFor="pari-event-date">Дата события</label><input id="pari-event-date" type="date" value={eventDate} onChange={event => {setEventDate(event.target.value);setError('')}}/><label>Варианты ответа</label><div className="row"><div className="yes">Да</div><div className="no">Нет</div></div></>}
      {format==='multi' && <><label>Варианты ответа</label>{options.map((option,index) => <div className="row" style={{margin:'8px 0'}} key={option.id}><input aria-label={`Вариант ${index+1}`} value={option.label} maxLength={160} onChange={event => {setOptions(current => current.map(item => item.id===option.id?{...item,label:event.target.value}:item));setDemoAnswer('');setDemoSent(false);setError('')}}/><button type="button" className="btn" aria-label={`Удалить вариант ${index+1}`} disabled={options.length<=2} onClick={() => {setOptions(current => current.filter(item => item.id!==option.id));setDemoAnswer('');setDemoSent(false)}}>×</button></div>)}<button type="button" className="btn wide" disabled={options.length>=20} onClick={() => setOptions(current => [...current,{id:crypto.randomUUID(),label:''}])}>＋ Добавить ответ</button></>}
      {format==='free' && <div className="settings"><small>Участники самостоятельно вводят свои прогнозы. Список ответов не требуется.</small></div>}
      <hr/><h2>03. Настройки участия</h2><label htmlFor="pari-deadline">Приём ответов до</label><div className="row"><input id="pari-deadline" className="grow" type="date" value={deadlineDate} onChange={event => {setDeadlineDate(event.target.value);setError('')}}/><input type="time" style={{width:135}} aria-label="Время окончания приёма ответов" value={deadlineTime} onChange={event => {setDeadlineTime(event.target.value);setError('')}}/></div><small>После этой даты и времени новые ответы не принимаются. Часовой пояс: {timezone}.</small>
      <div className="settings"><div className="row"><strong className="grow">Скрытые ответы</strong><button type="button" className={`switch ${hidden?'on':''}`} role="switch" aria-label="Скрытые ответы" aria-checked={hidden} onClick={() => setHidden(value => !value)}><i/></button></div><small>{hidden?'Ответы других участников станут доступны после окончания приёма прогнозов.':'Ответы участников видны сразу после отправки.'}</small></div>
      {error && <p className="error" role="alert">{error}</p>}
    </section><aside className="preview"><h2>▣ Предпросмотр</h2><small>Так пари увидят участники</small><div className="card"><div className="tag">{currentFormat.name.toUpperCase()}</div><h3>{draft.name || 'Название пари'}</h3><p>{draft.condition || 'Условия пари'}</p><hr/>
      {format==='binary' && <div className="meta"><span aria-hidden="true">▣</span><div><small>Дата события</small><b>{displayDate(eventDate)}</b></div></div>}
      <div className="meta"><span aria-hidden="true">◷</span><div><small>Приём ответов до</small><b>{displayDate(deadlineDate)} · {deadlineTime || '—'} ({timezone})</b></div></div><hr/><strong>Ваш ответ</strong>
      {format==='free' ? <><label htmlFor="demo-answer" className="muted">Ваш прогноз</label><textarea id="demo-answer" placeholder="Введите свой прогноз..." value={demoAnswer} disabled={demoSent} onChange={event => setDemoAnswer(event.target.value)}/></> : format==='binary' ? <div className="row" style={{marginTop:10}}>{['Да','Нет'].map((label,index) => <button type="button" key={label} className={`${index?'no':'yes'} ${demoAnswer===label?'selected':''}`} aria-pressed={demoAnswer===label} disabled={demoSent} onClick={() => setDemoAnswer(label)}>{label}</button>)}</div> : options.map(option => <button type="button" key={option.id} className={`btn choice ${demoAnswer===option.id?'selected':''}`} aria-pressed={demoAnswer===option.id} disabled={demoSent || !option.label.trim()} onClick={() => setDemoAnswer(option.id)}>{demoAnswer===option.id?'◉':'○'} {option.label || 'Новый вариант'}</button>)}
      {demoSent ? <><p className="success" role="status">✓ Ответ принят в демо-режиме</p><button type="button" className="btn wide" onClick={() => setDemoSent(false)}>Изменить ответ в демо</button></> : <button type="button" className="btn primary wide" disabled={format==='multi'?!options.some(option => option.id===demoAnswer):!demoAnswer.trim()} onClick={() => setDemoSent(true)}>Отправить ответ</button>}
      <hr/><small>Ответы участников</small>{hidden ? <div className="lock"><strong>Ответы скрыты</strong><small>Откроются {displayDate(deadlineDate)} в {deadlineTime || '—'} ({timezone})</small></div> : <div className="lock"><small>{demoSent?'Ваш демо-ответ сохранён в предпросмотре.':'Ответы будут отображаться здесь по мере поступления.'}</small></div>}
    </div><small style={{marginTop:14}}>ⓘ Предпросмотр обновляется автоматически.</small></aside></div>
    <div className="footer"><button type="button" className="btn" onClick={reset}>Сбросить</button><button type="button" className="btn primary" disabled={busy} onClick={() => void create()}>{busy?'Создание…':'Создать пари →'}</button></div>
    <div className="status"><b>Черновик</b><span>→ Приём ответов</span><span>→ Ожидание итога</span><span>→ Завершено</span></div>
  </main></>
}
