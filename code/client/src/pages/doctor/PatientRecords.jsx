import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doctorService } from '../../services/doctorService';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import {
  Shield, ShieldAlert, FileText, Plus, Pill, Download, Clock,
  ArrowLeft, AlertTriangle, Building, User, Lock, ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';

const PatientRecords = () => {
  const { healthId } = useParams();
  const navigate = useNavigate();

  const [records, setRecords] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [deniedMessage, setDeniedMessage] = useState('');

  const fetchRecords = async () => {
    try {
      setLoading(true);
      setAccessDenied(false);
      const res = await doctorService.getPatientRecords(healthId);
      setRecords(res.data.data || []);
      setMeta(res.data.meta || {});
    } catch (err) {
      if (err.response?.status === 403) {
        setAccessDenied(true);
        setDeniedMessage(err.response?.data?.message || 'Access denied or session revoked by patient.');
      } else {
        toast.error(err.response?.data?.message || 'Failed to fetch patient records');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [healthId]);

  const handleDownloadFile = async (recordId, title) => {
    try {
      const res = await doctorService.getFile(healthId, recordId);
      if (res.data?.data?.url) {
        window.open(res.data.data.url, '_blank');
      } else {
        toast.error('File URL not available');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Access to this file was denied');
    }
  };

  if (loading) return <LoadingSpinner />;

  if (accessDenied) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldAlert size={32} />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied or Revoked</h2>
        <p className="text-slate-600 mb-6">
          {deniedMessage || 'The patient has revoked consent or your active 24-hour verification session has expired.'}
        </p>
        <Link
          to="/doctor/find-patient"
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition"
        >
          <ArrowLeft size={16} /> Return to Find Patient
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-6">
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <button
            onClick={() => navigate('/doctor/find-patient')}
            className="flex items-center text-xs font-semibold text-slate-500 hover:text-slate-800 mb-2 transition"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Search
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">Patient Records</h1>
            <span className="font-mono text-xs px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg font-bold">
              {healthId}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Link
            to={`/doctor/patient/${healthId}/add-record`}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
          >
            <Plus size={15} /> Add Record
          </Link>
          <Link
            to={`/doctor/patient/${healthId}/prescribe`}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
          >
            <Pill size={15} /> Write Prescription
          </Link>
        </div>
      </div>

      {/* 🛡️ PRIVACY TRANSPARENCY BANNER */}
      {meta?.isFiltered && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl shadow-xs animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-amber-900">
                🛡️ Patient Privacy Notice: Filtered Medical View
              </h3>
              <p className="text-xs text-amber-800 mt-1">
                The patient has shared <strong>{meta.recordsVisible} of {meta.totalPatientRecords} records</strong> under{' '}
                <strong className="capitalize">{meta.scopeType?.replace('_', ' ') || 'Selective Access'}</strong>
                {meta.allowedCategories?.length > 0 && ` (Categories: ${meta.allowedCategories.join(', ')})`}.{' '}
                {meta.excludeSensitive && 'Sensitive and confidential records are restricted by patient consent policy.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Records Listing */}
      {records.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 p-12 text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700">No records available under this consent scope</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            The patient's current consent scope does not include any uploaded diagnostic records, or all records have been withheld.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {records.map((r) => (
            <div
              key={r._id}
              className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col justify-between hover:border-blue-200 transition"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 capitalize">
                    {r.category?.replace('_', ' ') || 'Record'}
                  </span>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock size={12} />
                    {new Date(r.recordDate || r.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 text-base mb-1">{r.title}</h3>
                
                {r.clinicalNotes ? (
                  <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 line-clamp-3 mb-3">
                    {r.clinicalNotes}
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 italic mb-3">No specific clinical notes attached.</p>
                )}

                <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                  {r.department && (
                    <span className="capitalize">
                      Dept: <strong className="text-slate-700">{r.department.replace('_', ' ')}</strong>
                    </span>
                  )}
                  {r.doctorName && (
                    <span>• Dr: {r.doctorName}</span>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Lock size={12} /> Authorized by Patient Consent
                </span>
                <button
                  onClick={() => handleDownloadFile(r._id, r.title)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                >
                  <Download size={13} /> View File
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PatientRecords;
