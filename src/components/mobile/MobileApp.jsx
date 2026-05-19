import { useState } from 'react'
import MobileInputPage from './MobileInputPage'
import MobilePersonalPage from './MobilePersonalPage'
import './styles/mobileReadonly.css'

export default function MobileApp() {
  const [page, setPage] = useState('input')

  if (page === 'input') {
    return <MobileInputPage onGoPersonal={() => setPage('personal')} />
  }
  return <MobilePersonalPage onGoInput={() => setPage('input')} />
}
