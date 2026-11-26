'use client'
import { useState, type FormEvent } from 'react'
import { browserClient } from '../client'

type Props = {
  uid: string
  name: string
  departmentId: string | null
  departments: { id: string; name: string }[]
  onSaved: (name: string, departmentId: string | null) => void
}

export function ProfileSettings({ uid, name, departmentId, departments, onSaved }: Props) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const displayName = String(fields.get('name')).trim()
    if (!displayName) {
      setMessage('Введите псевдоним.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const { data, error } = await browserClient().from('profiles')
        .update({ display_name: displayName, department_id: fields.get('department') || null })
        .eq('id', uid).select('display_name,department_id').single()
      if (error) throw error
      onSaved(data.display_name, data.department_id)
      setMessage('Изменения сохранены.')
    } catch {
      setMessage('Не удалось сохранить изменения. Попробуйте ещё раз.')
    } finally {
      setBusy(false)
    }
  }
  return <form onSubmit={save}>
    <label>Псевдоним<input name="name" defaultValue={name} maxLength={80} required /></label>
    <label>Отдел<select name="department" defaultValue={departmentId ?? ''}>
      <option value="">Без отдела</option>
      {departments.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></label>
    <button disabled={busy}>Сохранить изменения</button>
    <p role="status">{message}</p>
  </form>
}
