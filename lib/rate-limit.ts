import { NextResponse } from 'next/server';

const records=new Map<string,{count:number;until:number}>();
export function rateLimitKey(request:Request,scope:string){const forwarded=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();const address=forwarded||request.headers.get('x-real-ip')?.trim()||'unknown';return `${scope}:${address}`}
export function rateLimited(key:string,max=8,period=60_000){const now=Date.now();let value=records.get(key);if(!value||value.until<now){value={count:0,until:now+period};records.set(key,value)}value.count++;if(records.size>3000)for(const [k,v] of records)if(v.until<now)records.delete(k);return value.count>max}
export function tooManyRequests(){return NextResponse.json({error:'Too many attempts. Please wait one minute before trying again.'},{status:429,headers:{'Retry-After':'60'}})}
