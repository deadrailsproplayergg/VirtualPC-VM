import { useQueryClient } from "@tanstack/react-query";
import {
  useListVMs as useGeneratedListVMs,
  useCreateVM as useGeneratedCreateVM,
  useUpdateVM as useGeneratedUpdateVM,
  useDeleteVM as useGeneratedDeleteVM,
  useStartVM as useGeneratedStartVM,
  useStopVM as useGeneratedStopVM,
  useListDisks as useGeneratedListDisks,
  useCreateDisk as useGeneratedCreateDisk,
  useDeleteDisk as useGeneratedDeleteDisk,
} from "@workspace/api-client-react";

export const useListVMs = useGeneratedListVMs;
export const useListDisks = useGeneratedListDisks;

export function useCreateVM() {
  const qc = useQueryClient();
  return useGeneratedCreateVM({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/vms"] }),
    },
  });
}

export function useUpdateVM() {
  const qc = useQueryClient();
  return useGeneratedUpdateVM({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/vms"] }),
    },
  });
}

export function useDeleteVM() {
  const qc = useQueryClient();
  return useGeneratedDeleteVM({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/vms"] }),
    },
  });
}

export function useStartVM() {
  const qc = useQueryClient();
  return useGeneratedStartVM({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/vms"] }),
    },
  });
}

export function useStopVM() {
  const qc = useQueryClient();
  return useGeneratedStopVM({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/vms"] }),
    },
  });
}

export function useCreateDisk() {
  const qc = useQueryClient();
  return useGeneratedCreateDisk({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/disks"] }),
    },
  });
}

export function useDeleteDisk() {
  const qc = useQueryClient();
  return useGeneratedDeleteDisk({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/disks"] }),
    },
  });
}
