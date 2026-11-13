export interface Customer {
  id: number;
  ownerId: number;
  name: string;
  phone: string;
  email?: string | null;
  createdAt: string;
  isArchived: boolean;
  archivedAt?: string | null;
  _count?: {
    orders: number;
  };
}

export interface CustomerCreateInput {
  name: string;
  phone: string;
  email?: string | null;
}

export interface CustomerUpdateInput {
  name?: string;
  phone?: string;
  email?: string | null;
}

