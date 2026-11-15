import type {ReactNode} from 'react'
export function Help({title,children}:{title:string;children:ReactNode}){return <details className="context-help"><summary aria-label={'Help: '+title}>? <span>{title}</span></summary><div>{children}</div></details>}
