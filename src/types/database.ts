export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18';
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string;
          household_id: string;
          icon: string | null;
          id: string;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          household_id: string;
          icon?: string | null;
          id?: string;
          name: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          household_id?: string;
          icon?: string | null;
          id?: string;
          name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'categories_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
        ];
      };
      household_members: {
        Row: {
          created_at: string;
          household_id: string;
          role: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          household_id: string;
          role?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          household_id?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'household_members_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
        ];
      };
      households: {
        Row: {
          created_at: string;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      list_items: {
        Row: {
          archived_at: string | null;
          category_id: string | null;
          checked_at: string | null;
          checked_by: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          is_checked: boolean;
          list_id: string;
          note: string | null;
          product_id: string;
          quantity: number;
          unit: string;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          category_id?: string | null;
          checked_at?: string | null;
          checked_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_checked?: boolean;
          list_id: string;
          note?: string | null;
          product_id: string;
          quantity?: number;
          unit?: string;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          category_id?: string | null;
          checked_at?: string | null;
          checked_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_checked?: boolean;
          list_id?: string;
          note?: string | null;
          product_id?: string;
          quantity?: number;
          unit?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'list_items_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'list_items_list_id_fkey';
            columns: ['list_id'];
            isOneToOne: false;
            referencedRelation: 'list_summaries';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'list_items_list_id_fkey';
            columns: ['list_id'];
            isOneToOne: false;
            referencedRelation: 'lists';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'list_items_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      lists: {
        Row: {
          archived_at: string | null;
          created_at: string;
          created_by: string | null;
          household_id: string;
          id: string;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          household_id: string;
          id?: string;
          name: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          household_id?: string;
          id?: string;
          name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'lists_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
        ];
      };
      product_store_links: {
        Row: {
          created_at: string;
          matched_by: string;
          product_id: string;
          store_id: string;
          store_product_id: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          matched_by: string;
          product_id: string;
          store_id: string;
          store_product_id?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          matched_by?: string;
          product_id?: string;
          store_id?: string;
          store_product_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'product_store_links_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'product_store_links_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'product_store_links_store_product_id_fkey';
            columns: ['store_product_id'];
            isOneToOne: false;
            referencedRelation: 'store_products';
            referencedColumns: ['id'];
          },
        ];
      };
      products: {
        Row: {
          barcode: string | null;
          created_at: string;
          default_category_id: string | null;
          default_unit: string;
          household_id: string;
          id: string;
          name: string;
          name_normalized: string | null;
          updated_at: string;
        };
        Insert: {
          barcode?: string | null;
          created_at?: string;
          default_category_id?: string | null;
          default_unit?: string;
          household_id: string;
          id?: string;
          name: string;
          name_normalized?: string | null;
          updated_at?: string;
        };
        Update: {
          barcode?: string | null;
          created_at?: string;
          default_category_id?: string | null;
          default_unit?: string;
          household_id?: string;
          id?: string;
          name?: string;
          name_normalized?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'products_default_category_id_fkey';
            columns: ['default_category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'products_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string;
          id: string;
        };
        Insert: {
          created_at?: string;
          display_name: string;
          id: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          id?: string;
        };
        Relationships: [];
      };
      store_product_prices: {
        Row: {
          observed_at: string;
          price: number;
          reference_price: number | null;
          store_product_id: string;
        };
        Insert: {
          observed_at?: string;
          price: number;
          reference_price?: number | null;
          store_product_id: string;
        };
        Update: {
          observed_at?: string;
          price?: number;
          reference_price?: number | null;
          store_product_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'store_product_prices_store_product_id_fkey';
            columns: ['store_product_id'];
            isOneToOne: false;
            referencedRelation: 'store_products';
            referencedColumns: ['id'];
          },
        ];
      };
      store_products: {
        Row: {
          available: boolean;
          category: string | null;
          created_at: string;
          external_id: string;
          id: string;
          image_url: string | null;
          is_pack: boolean;
          name: string;
          name_normalized: string | null;
          packaging: string | null;
          price: number;
          reference_format: string | null;
          reference_price: number | null;
          seen_at: string;
          size_format: string | null;
          store_id: string;
          unit_size: number | null;
          updated_at: string;
          url: string | null;
        };
        Insert: {
          available?: boolean;
          category?: string | null;
          created_at?: string;
          external_id: string;
          id?: string;
          image_url?: string | null;
          is_pack?: boolean;
          name: string;
          name_normalized?: string | null;
          packaging?: string | null;
          price: number;
          reference_format?: string | null;
          reference_price?: number | null;
          seen_at?: string;
          size_format?: string | null;
          store_id: string;
          unit_size?: number | null;
          updated_at?: string;
          url?: string | null;
        };
        Update: {
          available?: boolean;
          category?: string | null;
          created_at?: string;
          external_id?: string;
          id?: string;
          image_url?: string | null;
          is_pack?: boolean;
          name?: string;
          name_normalized?: string | null;
          packaging?: string | null;
          price?: number;
          reference_format?: string | null;
          reference_price?: number | null;
          seen_at?: string;
          size_format?: string | null;
          store_id?: string;
          unit_size?: number | null;
          updated_at?: string;
          url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'store_products_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
        ];
      };
      stores: {
        Row: {
          catalog_synced_at: string | null;
          has_catalog: boolean;
          id: string;
          name: string;
          sort_order: number;
        };
        Insert: {
          catalog_synced_at?: string | null;
          has_catalog?: boolean;
          id: string;
          name: string;
          sort_order?: number;
        };
        Update: {
          catalog_synced_at?: string | null;
          has_catalog?: boolean;
          id?: string;
          name?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      list_summaries: {
        Row: {
          archived_at: string | null;
          checked_count: number | null;
          created_at: string | null;
          created_by: string | null;
          household_id: string | null;
          id: string | null;
          name: string | null;
          pending_count: number | null;
          sort_order: number | null;
          updated_at: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'lists_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Functions: {
      auto_link_products: {
        Args: { p_product_ids: string[]; p_store: string };
        Returns: undefined;
      };
      check_sync_secret: { Args: { secret: string }; Returns: boolean };
      is_household_member: { Args: { hh: string }; Returns: boolean };
      normalize_name: { Args: { value: string }; Returns: string };
      reorder_categories: { Args: { ids: string[] }; Returns: undefined };
      reorder_lists: { Args: { ids: string[] }; Returns: undefined };
      search_store_products: {
        Args: { p_limit?: number; p_query: string; p_store: string };
        Returns: {
          available: boolean;
          category: string | null;
          created_at: string;
          external_id: string;
          id: string;
          image_url: string | null;
          is_pack: boolean;
          name: string;
          name_normalized: string | null;
          packaging: string | null;
          price: number;
          reference_format: string | null;
          reference_price: number | null;
          seen_at: string;
          size_format: string | null;
          store_id: string;
          unit_size: number | null;
          updated_at: string;
          url: string | null;
        }[];
        SetofOptions: {
          from: '*';
          to: 'store_products';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      seed_household_defaults: { Args: { hh: string }; Returns: undefined };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema['Tables'] & DefaultSchema['Views']) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
