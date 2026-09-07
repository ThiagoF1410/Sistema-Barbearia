const paths = {
  menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
  close: <><path d="m6 6 12 12M18 6 6 18"/></>,
  home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v11h14V10M9 21v-7h6v7"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  crown: <><path d="M4 17 2.8 7.5l5 3.2L12 4l4.2 6.7 5-3.2L20 17Z"/><path d="M5 20h14M7 14h10"/></>,
  razor: <><path d="m4 19 8.2-8.2M8.3 20.5l-4.8-4.8 2.2-2.2 4.8 4.8Z"/><path d="m11 12 6.8-6.8c1-1 2.5-1.1 3.2-.4.7.7.6 2.2-.4 3.2l-6.8 6.8Z"/></>,
  scissors: <><circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="m8.5 15.5 8-11M15.5 15.5l-8-11"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/><path d="m9 16 2 2 4-5"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  shield: <><path d="M12 3 4.5 6v5.5c0 4.5 3 7.6 7.5 9.5 4.5-1.9 7.5-5 7.5-9.5V6Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></>,
  bottle: <><path d="M9 3h6v4l2 2v11H7V9l2-2Z"/><path d="M9 7h6m-5 6h4"/></>,
  profile: <><path d="M7 21v-2a5 5 0 0 1 10 0v2"/><circle cx="12" cy="8" r="4"/><path d="M8.5 10.5c1.4 2.2 5.6 2.2 7 0"/></>,
  users: <><circle cx="9" cy="9" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M3.5 20v-2a5.5 5.5 0 0 1 11 0v2m1-5a4.5 4.5 0 0 1 5 4.5V20"/></>,
  chart: <><path d="M4 20V10m6 10V4m6 16v-7m5 7H2"/></>,
  logout: <><path d="M14 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-3"/><path d="M10 12h11m-4-4 4 4-4 4"/></>,
  back: <><path d="m15 18-6-6 6-6"/></>,
  next: <><path d="m9 18 6-6-6-6"/></>,
  holiday: <><path d="M5 21h14M7 18h10l-1-8H8Z"/><path d="M12 3v4M9.5 5h5"/><path d="m8 10-3-3m11 3 3-3"/></>,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/></>,
  trash: <><path d="M4 7h16M9 3h6l1 4M7 7l1 14h8l1-14M10 11v6m4-6v6"/></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/></>,
  eye: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></>,
  eyeOff: <><path d="m3 3 18 18M10.6 6.2A10 10 0 0 1 12 6c6 0 9.5 6 9.5 6a15 15 0 0 1-2.1 2.8M6.2 6.2C3.8 8 2.5 12 2.5 12s3.5 6 9.5 6a9.8 9.8 0 0 0 3-.5M9.9 9.9a3 3 0 0 0 4.2 4.2"/></>,
  emptyCircle: <><circle cx="12" cy="12" r="8"/></>,
  location: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
  quote: <><path d="M5 11h5v8H3v-6c0-5 2-8 6-9M16 11h5v8h-7v-6c0-5 2-8 6-9"/></>,
  history: <><path d="M4 7v5h5M5 12a8 8 0 1 0 2-5.3L4 9"/><path d="M12 8v5l3 2"/></>,
  empty: <><path d="M6 4h12v17H6Z"/><path d="M9 2h6v4H9Zm0 9 6 6m0-6-6 6"/></>,
  professional: <><circle cx="12" cy="8" r="3.5"/><path d="M6 21v-2a6 6 0 0 1 12 0v2M8 5l4-2 4 2"/></>,
  check: <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></>,
  phone: <><path d="M6.5 3h3l1.2 5-2 1.5a15 15 0 0 0 5.8 5.8l1.5-2 5 1.2v3c0 1.7-1.3 3-3 3C10 20.5 3.5 14 3.5 6a3 3 0 0 1 3-3Z"/></>,
  alert: <><path d="M12 3 2.5 20h19Z"/><path d="M12 9v5m0 3h.01"/></>,
  cart: <><path d="M3 4h2l2.2 10.5a2 2 0 0 0 2 1.5h7.6a2 2 0 0 0 2-1.6L20 8H6"/><circle cx="10" cy="20" r="1"/><circle cx="17" cy="20" r="1"/></>,
  bag: <><path d="M5 8h14l-1 13H6Z"/><path d="M9 10V6a3 3 0 0 1 6 0v4"/></>,
  card: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></>,
  money: <><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M7 9H6v1m11-1h1v1M7 15H6v-1m11 1h1v-1"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
  message: <><path d="M4 5h16v11H9l-5 4Z"/><path d="M8 9h8M8 12h5"/></>,
  whatsapp: <><path d="M20.5 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.6-4.7A8.5 8.5 0 1 1 20.5 11.5Z"/><path d="M8.2 7.6c.3-.5.6-.5.9-.5h.5l1 2.4c.1.3 0 .5-.2.7l-.7.8c.8 1.6 2 2.7 3.7 3.4l.7-.9c.2-.3.5-.3.8-.2l2.2 1c.3.1.4.4.4.7-.1 1.2-1.1 2.1-2.3 2.2-3.9.1-8.1-3.8-8.4-7.7 0-.6.5-1.5 1.4-1.9Z"/></>,
}

export default function BrandIcon({ name, size = 24, className = '', label }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {paths[name] || paths.crown}
    </svg>
  )
}
