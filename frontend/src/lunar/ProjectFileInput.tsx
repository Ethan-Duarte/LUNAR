import {useEffect,useRef,useState} from 'react'
// File chooser cancellation is native (not React onCancel). Never begin an import without a File.
export function ProjectFileInput({label,onOpen}:{label:string;onOpen:(file:File)=>void|Promise<void>}){
 const [error,setError]=useState(''),ref=useRef<HTMLInputElement>(null)
 useEffect(()=>{const input=ref.current;const cancel=(e:Event)=>{e.stopPropagation();setError('')};input?.addEventListener('cancel',cancel);return()=>input?.removeEventListener('cancel',cancel)},[])
 return <div className="project-file-control"><label>{label}<input ref={ref} type="file" accept=".json,application/json" onChange={e=>{const input=e.currentTarget,file=input.files?.[0];input.value='';if(!file)return;setError('');Promise.resolve().then(()=>onOpen(file)).catch(err=>setError(err instanceof Error?err.message:String(err)))}}/></label>{error&&<p role="alert">Project could not be opened: {error}</p>}</div>
}
