import {
  notImplemented, type Actor, type PropertyInput, type PropertyListItemDto, type PropertyStatus, type ServiceResult,
} from "@/contracts";

// Pieza 2B. agencyId SIEMPRE sale del Actor, nunca del cliente.
export type PropertyListFilters = { status?: PropertyStatus; operation?: "sale" | "rent"; type?: string; page?: number };

export const createProperty = async (_a: Actor, _i: PropertyInput, _agentId?: string): Promise<ServiceResult<{ id: string; slug: string }>> =>
  notImplemented("createProperty");
export const updateProperty = async (_a: Actor, _id: string, _i: PropertyInput): Promise<ServiceResult<void>> => notImplemented("updateProperty");
export const getProperty = async (_a: Actor, _id: string): Promise<ServiceResult<PropertyInput & { id: string; status: PropertyStatus; slug: string }>> =>
  notImplemented("getProperty");
export const listMyProperties = async (_a: Actor, _f: PropertyListFilters): Promise<ServiceResult<{ items: PropertyListItemDto[]; total: number }>> =>
  notImplemented("listMyProperties");
export const changeStatus = async (_a: Actor, _id: string, _status: PropertyStatus): Promise<ServiceResult<void>> => notImplemented("changeStatus");
export const deleteProperty = async (_a: Actor, _id: string): Promise<ServiceResult<void>> => notImplemented("deleteProperty");
