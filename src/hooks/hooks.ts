import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Driver, Trip, Vehicle } from '../types/types';
import { api } from '../services/services';

// Drivers hooks
export const useDrivers = () => {
  return useQuery({
    queryKey: ['drivers'],
    queryFn: api.getDrivers,
  });
};

export const useDriver = (id: number) => {
  return useQuery({
    queryKey: ['drivers', id],
    queryFn: () => api.getDriver(id),
    enabled: !!id,
  });
};

export const useCreateDriver = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createDriver,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });
};

export const useUpdateDriver = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Driver> }) =>
      api.updateDriver(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
  });
};

export const useDeleteDriver = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteDriver,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
  });
};

// Trips hooks
export const useTrips = () => {
  return useQuery({
    queryKey: ['trips'],
    queryFn: api.getTrips,
  });
};

export const useTrip = (id: number) => {
  return useQuery({
    queryKey: ['trips', id],
    queryFn: () => api.getTrip(id),
    enabled: !!id,
  });
};

export const useCreateTrip = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createTrip,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });
};

export const useUpdateTrip = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Trip> }) =>
      api.updateTrip(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });
};

export const useDeleteTrip = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteTrip,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });
};

// Vehicles hooks
export const useVehicles = () => {
  return useQuery({
    queryKey: ['vehicles'],
    queryFn: api.getVehicles,
  });
};

export const useVehicle = (id: number) => {
  return useQuery({
    queryKey: ['vehicles', id],
    queryFn: () => api.getVehicle(id),
    enabled: !!id,
  });
};

export const useCreateVehicle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createVehicle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });
};

export const useCreateVehicleWithDriver = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createVehicleWithDriver,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
  });
};

export const useUpdateVehicle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Vehicle> }) =>
      api.updateVehicle(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });
};

export const useDeleteVehicle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteVehicle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });
};