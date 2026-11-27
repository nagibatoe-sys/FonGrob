'use client'
import { useParams } from 'next/navigation'
import { ProfileStats } from '../../profile/stats'
import { SiteNav } from '../../site-nav'
export default function PublicProfile(){const {id}=useParams<{id:string}>();return <><SiteNav/><main className="feature-page"><h1>Профиль участника</h1><ProfileStats profileId={id}/></main></>}
