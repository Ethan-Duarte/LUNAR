import {Component,type ReactNode} from 'react'
export class InterfaceBoundary extends Component<{children:ReactNode;label:string},{error:string|null}>{
 state:{error:string|null}={error:null}
 static getDerivedStateFromError(error:unknown){return {error:error instanceof Error?error.message:String(error)}}
 componentDidCatch(error:unknown){console.error('LUNAR interface recovery:',error)}
 render(){if(!this.state.error)return this.props.children
  return <section className="interface-recovery" role="alert"><h2>{this.props.label} paused safely</h2><p>Your saved projects have not been deleted. Copy the error below when reporting this issue.</p><pre>{this.state.error}</pre><button onClick={()=>this.setState({error:null})}>Retry this view</button><button onClick={()=>window.location.reload()}>Reload LUNAR</button></section>
 }
}
