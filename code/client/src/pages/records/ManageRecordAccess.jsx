import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, ShieldOff, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { documentAccessService } from '../../services/documentAccessService';

export default function ManageRecordAccess() {
  const [data, setData] = useState({ doctor: null, records: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const refresh = useCallback(async () => {
    try { const response = await documentAccessService.getMine(); setData(response.data.data); }
    catch (error) { toast.error(error.response?.data?.message || 'Could not load sharing settings'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const toggle = async (record) => {
    setBusy(record._id);
    try {
      const action = record.accessStatus === 'shared' ? documentAccessService.revoke : documentAccessService.grant;
      await action(record._id);
      toast.success(record.accessStatus === 'shared' ? 'Access revoked' : 'Record shared with your assigned doctor');
      await refresh();
    } catch (error) { toast.error(error.response?.data?.message || 'Could not update access'); }
    finally { setBusy(null); }
  };
  if (loading) return <div className="p-10 text-center">Loading access settings…</div>;
  return <main className="max-w-4xl mx-auto py-8 px-4 space-y-6">
    <header><h1 className="text-2xl font-bold text-slate-900">Manage Medical Record Access</h1><p className="mt-1 text-slate-500">Choose which records your assigned doctor can view.</p></header>
    <section className="rounded-xl border bg-white p-5">
      <h2 className="font-semibold text-slate-800">Assigned doctor</h2>
      {data.doctor ? <p className="mt-2 text-slate-600">Dr. {data.doctor.firstName} {data.doctor.lastName}{data.doctor.doctorProfile?.specialization ? ` · ${data.doctor.doctorProfile.specialization}` : ''}</p> : <p className="mt-2 text-amber-700">No assigned doctor is configured. Contact your administrator to establish your patient-doctor assignment.</p>}
    </section>
    {!data.records.length ? <section className="rounded-xl border border-dashed bg-white p-10 text-center text-slate-500"><FileText className="mx-auto mb-3"/><p>No medical records are available to share.</p></section> : <section className="divide-y rounded-xl border bg-white">
      {data.records.map((record) => <article key={record._id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div><h3 className="font-semibold text-slate-900">{record.title}</h3><p className="text-sm text-slate-500">{record.category?.replaceAll('_', ' ')} · {new Date(record.recordDate || record.createdAt).toLocaleDateString()}</p></div>
        <div className="flex items-center gap-3"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${record.accessStatus === 'shared' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-700'}`}>{record.accessStatus === 'shared' ? 'Shared' : 'Private'}</span>
          <button disabled={!data.doctor || busy === record._id} onClick={() => toggle(record)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50">{record.accessStatus === 'shared' ? <><ShieldOff size={16}/> Revoke</> : <><ShieldCheck size={16}/> Grant access</>}</button>
        </div>
      </article>)}
    </section>}
  </main>;
}
