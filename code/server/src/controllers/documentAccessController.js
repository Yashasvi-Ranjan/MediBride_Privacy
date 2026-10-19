const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');
const MedicalRecord = require('../models/MedicalRecord');
const Permission = require('../models/DocumentAccessPermission');
const AccessSession = require('../models/AccessSession');
const AccessLog = require('../models/AccessLog');
const cloudinary = require('../config/cloudinary');

const assignedDoctor = async (patient) => {
  if (!patient.assignedDoctorId) return null;
  return User.findOne({ _id: patient.assignedDoctorId, role: 'doctor' }).select('firstName lastName email doctorProfile.specialization');
};

exports.listMyAccess = asyncHandler(async (req, res) => {
  const doctor = await assignedDoctor(req.user);
  const records = await MedicalRecord.find({ userId: req.user._id }).sort({ recordDate: -1 }).lean();
  const permissions = doctor ? await Permission.find({ patientId: req.user._id, doctorId: doctor._id }).lean() : [];
  const byRecord = new Map(permissions.map((p) => [String(p.recordId), p]));
  res.json({ success: true, data: {
    doctor,
    records: records.map((record) => ({ ...record, accessStatus: byRecord.get(String(record._id))?.status === 'active' ? 'shared' : 'private' })),
  } });
});

exports.grant = asyncHandler(async (req, res) => changePermission(req, res, true));
exports.revoke = asyncHandler(async (req, res) => changePermission(req, res, false));

async function changePermission(req, res, grant) {
  const patient = req.user;
  const doctor = await assignedDoctor(patient);
  if (!doctor) throw new ApiError(409, 'No assigned doctor is configured for this patient');
  const record = await MedicalRecord.findOne({ _id: req.params.recordId, userId: patient._id }).select('_id');
  if (!record) throw new ApiError(404, 'Record not found');
  const now = new Date();
  let permission;
  try { permission = await Permission.findOneAndUpdate(
    { patientId: patient._id, recordId: record._id, doctorId: doctor._id },
    grant
      ? { $set: { status: 'active', grantedAt: now, revokedAt: null }, $setOnInsert: { patientId: patient._id, recordId: record._id, doctorId: doctor._id } }
      : { $set: { status: 'revoked', revokedAt: now }, $setOnInsert: { patientId: patient._id, recordId: record._id, doctorId: doctor._id, grantedAt: now } },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  ); } catch (error) {
    if (error.code !== 11000) throw error;
    permission = await Permission.findOneAndUpdate(
      { patientId: patient._id, recordId: record._id, doctorId: doctor._id },
      grant ? { $set: { status: 'active', grantedAt: now, revokedAt: null } } : { $set: { status: 'revoked', revokedAt: now } },
      { new: true, runValidators: true }
    );
  }
  await AccessLog.create({ patientId: patient._id, doctorId: doctor._id, action: grant ? 'access_granted' : 'access_revoked', details: `${grant ? 'Granted' : 'Revoked'} access to record ${record._id}`, ipAddress: req.ip });
  res.json({ success: true, data: { recordId: record._id, status: permission.status } });
}

exports.getAuthorizedFile = asyncHandler(async (req, res) => {
  const patient = req.patient;
  const doctorId = req.user._id;
  if (String(patient.assignedDoctorId || '') !== String(doctorId)) throw new ApiError(403, 'Only the assigned doctor may access this record');
  const permission = await Permission.exists({ patientId: patient._id, recordId: req.params.recordId, doctorId, status: 'active' });
  if (!permission) throw new ApiError(403, 'Document access has not been granted');
  const record = await MedicalRecord.findOne({ _id: req.params.recordId, userId: patient._id }).select('filePublicId fileType');
  if (!record) throw new ApiError(404, 'Record not found');
  if (!record.filePublicId) throw new ApiError(404, 'No protected file is available for this record');
  const format = (record.fileType || '').includes('pdf') ? 'pdf' : undefined;
  const url = cloudinary.utils.private_download_url(record.filePublicId, format, { expires_at: Math.floor(Date.now() / 1000) + 300 });
  res.json({ success: true, data: { url, expiresInSeconds: 300 } });
});

exports.listDoctorRecords = asyncHandler(async (req, res) => {
  const patient = req.patient;
  if (String(patient.assignedDoctorId || '') !== String(req.user._id)) throw new ApiError(403, 'Only the assigned doctor may view shared records');
  const permissions = await Permission.find({ patientId: patient._id, doctorId: req.user._id, status: 'active' }).select('recordId');
  const ids = permissions.map((p) => p.recordId);
  const records = await MedicalRecord.find({ _id: { $in: ids }, userId: patient._id }).sort({ recordDate: -1 }).select('-fileUrl -filePublicId');
  res.json({ success: true, data: records });
});
