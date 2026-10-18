import http from 'node:http';
import {seed} from './catalog.js';
import {release,maxQuantity} from './policy.js';
import {html,client} from './ui.js';

let items=seed();
let changes=[];
let nextChangeId=1;
function itemFor(id){return items.find(item=>item.id===id);}
function tag(item){return '"'+item.id+'-'+item.revision+'"';}
function reply(res,status,value,headers={}){
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers});
  res.end(value===null?'':JSON.stringify(value));
}
function readJson(req,res,done){
  if(!(req.headers['content-type']||'').startsWith('application/json'))return reply(res,415,{error:'json_required'});
  let body='',oversize=false;
  req.setEncoding('utf8');
  req.on('data',chunk=>{if(!oversize){body+=chunk;if(Buffer.byteLength(body,'utf8')>4096){oversize=true;body='';}}});
  req.on('end',()=>{
    if(oversize)return reply(res,413,{error:'body_too_large'});
    let value;try{value=JSON.parse(body);}catch{return reply(res,400,{error:'invalid_json'});}
    done(value);
  });
}
http.createServer((req,res)=>{
  const url=new URL(req.url,'http://stockroom.local');
  console.log('stockroom',release,req.method,url.pathname);
  if(req.method==='GET' && url.pathname==='/'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});return res.end(html);}
  if(req.method==='GET' && url.pathname==='/client.js'){res.writeHead(200,{'content-type':'text/javascript; charset=utf-8','cache-control':'no-store'});return res.end(client);}
  if(url.pathname==='/api/health')return reply(res,200,{service:'stockroom',release,maxQuantity});
  if(url.pathname==='/api/items'){
    if(req.method!=='GET')return reply(res,405,{error:'method_not_allowed'},{allow:'GET'});
    return reply(res,200,{items,maxQuantity,release});
  }
  if(url.pathname==='/api/changes'){
    if(req.method!=='GET')return reply(res,405,{error:'method_not_allowed'},{allow:'GET'});
    return reply(res,200,{changes});
  }
  if(url.pathname==='/api/reset'){
    if(req.method!=='POST')return reply(res,405,{error:'method_not_allowed'},{allow:'POST'});
    items=seed();changes=[];nextChangeId=1;return reply(res,200,{reset:true});
  }
  if(url.pathname.startsWith('/api/items/')){
    const id=url.pathname.slice('/api/items/'.length),item=itemFor(id);
    if(!item)return reply(res,404,{error:'unknown_item'});
    if(req.method==='GET' || req.method==='HEAD'){
      const headers={etag:tag(item),'cache-control':'private, no-cache'};
      if(req.headers['if-none-match']===tag(item))return reply(res,304,null,headers);
      return reply(res,200,req.method==='HEAD'?null:{item},headers);
    }
    if(req.method!=='PUT')return reply(res,405,{error:'method_not_allowed'},{allow:'GET, HEAD, PUT'});
    return readJson(req,res,body=>{
      const current=itemFor(id);
      if(!req.headers['if-match'])return reply(res,428,{error:'version_required'});
      if(req.headers['if-match']!==tag(current))return reply(res,412,{error:'version_conflict',current},{etag:tag(current)});
      if(!body || !Number.isInteger(body.quantity) || body.quantity<0 || body.quantity>maxQuantity)return reply(res,422,{error:'quantity_out_of_range',maxQuantity});
      const before=current.quantity;
      current.quantity=body.quantity;current.revision++;
      changes.unshift({id:nextChangeId++,itemId:id,name:current.name,before,after:current.quantity,revision:current.revision});
      if(changes.length>20)changes.pop();
      return reply(res,200,{item:current},{etag:tag(current)});
    });
  }
  return reply(res,404,{error:'not_found'});
}).listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('stockroom ready',release));
