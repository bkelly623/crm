import { createRoot } from 'react-dom/client';
import '../../src/app/globals.css';
import Layout from '../../src/app/dashboard/layout';
import Dialer from '../../src/app/dashboard/dialer/page';
import Leads from '../../src/app/dashboard/leads/page';
import Detail from '../../src/app/dashboard/leads/[id]/page';
import Home from '../../src/app/dashboard/page';
import Users from '../../src/app/dashboard/users/page';
import Settings from '../../src/app/dashboard/settings/page';
import Tasks from '../../src/app/dashboard/tasks/page';
import Calls from '../../src/app/dashboard/call-history/page';
import { lead } from './server';
// Isolated harness only: no real authentication, SDK, provider or API requests.
window.fetch = async (input, init) => {
 const url = String(input);
 if (init?.method && init.method !== 'GET') return Response.json({error:'Harness blocks writes'}, {status:403});
 if (url.includes('/api/dialer/intents')) return Response.json({intent:null});
 if (url.includes('/api/dialer/next-lead')) return Response.json({lead});
 if (url.includes('/api/dialer/numbers')) return Response.json({numbers:[{sid:'PN'+'1'.repeat(32),phoneNumber:'+12025550101',friendlyName:'SYNTHETIC office'}], nextPage:null,hasMore:false,truncated:false});
 if (url.includes('/api/lead-organizers/')) return Response.json({items:[],nextCursor:null});
 if (url.startsWith('/api/leads?')) return Response.json({leads:[lead],nextCursor:null});
 return Response.json({error:'Harness blocks unknown request'}, {status:403});
};
const pages = { dialer: () => Dialer(), leads: () => Leads({searchParams:Promise.resolve({})}), detail: () => Detail({params:Promise.resolve({id:lead.id})}), home: () => Home(), users: () => Users(), settings: () => Settings(), tasks: () => Tasks(), calls: () => Calls() };
const key = new URLSearchParams(location.search).get('screen') as keyof typeof pages || 'dialer';
const page = await pages[key]();
createRoot(document.getElementById('root')!).render(<><div style={{background:'#ffe58f',padding:4,fontSize:12}}>SYNTHETIC COMPONENT HARNESS — no live account or calls</div>{await Layout({children:page})}</>);
