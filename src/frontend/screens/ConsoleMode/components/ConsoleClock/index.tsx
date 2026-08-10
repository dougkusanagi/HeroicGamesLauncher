import { useEffect, useState } from 'react'

export default function ConsoleClock() {
  const [time, setTime] = useState<string>('')

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const formatted = now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })
      setTime(formatted)
    }

    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  if (!time) return null

  return (
    <div className="consoleClock" aria-live="off">
      {time}
    </div>
  )
}
