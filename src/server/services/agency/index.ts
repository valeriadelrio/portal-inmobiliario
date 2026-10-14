import {
  notImplemented, type Actor, type AgencyPublicDto, type InviteMemberInput, type MemberProfileInput,
  type MemberPublicDto, type MyAgencyDto, type RegisterAgencyInput, type ServiceResult, type UpdateAgencyInput,
} from "@/contracts";

// Pieza 2A. Cada función recibe el Actor primero y devuelve ServiceResult.
// Se apoyan en las funciones SQL: app_register_agency, app_set_agency_status, app_my_agency,
// app_preview_invitation, app_accept_invitation, app_set_member_role, app_remove_member.

export const registerAgency = async (_a: Actor, _i: RegisterAgencyInput): Promise<ServiceResult<{ agencyId: string }>> =>
  notImplemented("registerAgency");
export const getMyAgency = async (_a: Actor): Promise<ServiceResult<MyAgencyDto | null>> => notImplemented("getMyAgency");
export const updateAgency = async (_a: Actor, _i: UpdateAgencyInput): Promise<ServiceResult<void>> => notImplemented("updateAgency");
export const listAgenciesForAdmin = async (_a: Actor, _status?: string): Promise<ServiceResult<(AgencyPublicDto & { status: string; createdAt: string })[]>> =>
  notImplemented("listAgenciesForAdmin");
export const setAgencyStatus = async (_a: Actor, _agencyId: string, _status: "approved" | "rejected" | "suspended", _reason?: string): Promise<ServiceResult<void>> =>
  notImplemented("setAgencyStatus");

export type MemberRow = MemberPublicDto & { userId: string; role: string; status: string };
export type InvitationRow = { id: string; email: string; role: string; status: string; expiresAt: string };
export const listMembers = async (_a: Actor): Promise<ServiceResult<MemberRow[]>> => notImplemented("listMembers");
export const inviteMember = async (_a: Actor, _i: InviteMemberInput): Promise<ServiceResult<{ link: string }>> => notImplemented("inviteMember");
export const listInvitations = async (_a: Actor): Promise<ServiceResult<InvitationRow[]>> => notImplemented("listInvitations");
export const revokeInvitation = async (_a: Actor, _id: string): Promise<ServiceResult<void>> => notImplemented("revokeInvitation");
export const previewInvitation = async (_token: string): Promise<ServiceResult<{ agencyName: string; email: string; role: string }>> =>
  notImplemented("previewInvitation");
export const acceptInvitation = async (_a: Actor, _token: string, _displayName: string): Promise<ServiceResult<{ memberId: string }>> =>
  notImplemented("acceptInvitation");
export const updateMemberProfile = async (_a: Actor, _i: MemberProfileInput): Promise<ServiceResult<void>> => notImplemented("updateMemberProfile");
export const setMemberRole = async (_a: Actor, _memberId: string, _role: "agent" | "agency_admin"): Promise<ServiceResult<void>> =>
  notImplemented("setMemberRole");
export const removeMember = async (_a: Actor, _memberId: string, _reassignTo?: string): Promise<ServiceResult<void>> => notImplemented("removeMember");
export const getPublicAgencyBySlug = async (_slug: string): Promise<ServiceResult<{ agency: AgencyPublicDto; members: MemberPublicDto[] } | null>> =>
  notImplemented("getPublicAgencyBySlug");
