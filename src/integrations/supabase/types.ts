export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          audience: string
          body: string
          created_at: string
          created_by: string | null
          event_id: string | null
          id: string
          organization_id: string
          title: string
        }
        Insert: {
          audience?: string
          body: string
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          id?: string
          organization_id: string
          title: string
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          id?: string
          organization_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      application_activity: {
        Row: {
          actor_user_id: string | null
          application_id: string
          created_at: string
          event_type: string
          from_value: string | null
          id: string
          payload: Json | null
          to_value: string | null
        }
        Insert: {
          actor_user_id?: string | null
          application_id: string
          created_at?: string
          event_type: string
          from_value?: string | null
          id?: string
          payload?: Json | null
          to_value?: string | null
        }
        Update: {
          actor_user_id?: string | null
          application_id?: string
          created_at?: string
          event_type?: string
          from_value?: string | null
          id?: string
          payload?: Json | null
          to_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "application_activity_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      application_documents: {
        Row: {
          application_id: string
          created_at: string
          id: string
          kind: string | null
          name: string
          url: string
        }
        Insert: {
          application_id: string
          created_at?: string
          id?: string
          kind?: string | null
          name: string
          url: string
        }
        Update: {
          application_id?: string
          created_at?: string
          id?: string
          kind?: string | null
          name?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          ai_extraction: Json | null
          applicant_email: string | null
          applicant_phone: string | null
          applied_at: string
          assigned_booth_id: string | null
          business_name: string | null
          category: string | null
          contact_name: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          entry_method: Database["public"]["Enums"]["application_entry_method"]
          event_id: string
          id: string
          internal_notes: string | null
          needs_electricity: boolean
          notes: string | null
          organization_id: string
          payment_amount: number | null
          products_sold: string | null
          requested_location: string | null
          size_requested: string | null
          special_requests: string | null
          status: Database["public"]["Enums"]["application_status"]
          updated_at: string
          vendor_profile_id: string
        }
        Insert: {
          ai_extraction?: Json | null
          applicant_email?: string | null
          applicant_phone?: string | null
          applied_at?: string
          assigned_booth_id?: string | null
          business_name?: string | null
          category?: string | null
          contact_name?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          entry_method?: Database["public"]["Enums"]["application_entry_method"]
          event_id: string
          id?: string
          internal_notes?: string | null
          needs_electricity?: boolean
          notes?: string | null
          organization_id: string
          payment_amount?: number | null
          products_sold?: string | null
          requested_location?: string | null
          size_requested?: string | null
          special_requests?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          vendor_profile_id: string
        }
        Update: {
          ai_extraction?: Json | null
          applicant_email?: string | null
          applicant_phone?: string | null
          applied_at?: string
          assigned_booth_id?: string | null
          business_name?: string | null
          category?: string | null
          contact_name?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          entry_method?: Database["public"]["Enums"]["application_entry_method"]
          event_id?: string
          id?: string
          internal_notes?: string | null
          needs_electricity?: boolean
          notes?: string | null
          organization_id?: string
          payment_amount?: number | null
          products_sold?: string | null
          requested_location?: string | null
          size_requested?: string | null
          special_requests?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          vendor_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_assigned_booth_id_fkey"
            columns: ["assigned_booth_id"]
            isOneToOne: false
            referencedRelation: "event_booths"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_vendor_profile_id_fkey"
            columns: ["vendor_profile_id"]
            isOneToOne: false
            referencedRelation: "vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          event_id: string | null
          id: string
          kind: string | null
          name: string
          organization_id: string
          uploaded_by: string | null
          url: string
          vendor_profile_id: string | null
          venue_id: string | null
          visibility: string
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          id?: string
          kind?: string | null
          name: string
          organization_id: string
          uploaded_by?: string | null
          url: string
          vendor_profile_id?: string | null
          venue_id?: string | null
          visibility?: string
        }
        Update: {
          created_at?: string
          event_id?: string | null
          id?: string
          kind?: string | null
          name?: string
          organization_id?: string
          uploaded_by?: string | null
          url?: string
          vendor_profile_id?: string | null
          venue_id?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_vendor_profile_id_fkey"
            columns: ["vendor_profile_id"]
            isOneToOne: false
            referencedRelation: "vendor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      event_booths: {
        Row: {
          assigned_application_id: string | null
          category: string | null
          code: string
          created_at: string
          event_id: string
          height: number
          id: string
          is_electric: boolean
          is_premium: boolean
          is_reserved: boolean
          notes: string | null
          price: number | null
          rotation: number
          size_label: string | null
          status: Database["public"]["Enums"]["booth_status"]
          template_booth_id: string | null
          updated_at: string
          width: number
          x: number
          y: number
        }
        Insert: {
          assigned_application_id?: string | null
          category?: string | null
          code: string
          created_at?: string
          event_id: string
          height?: number
          id?: string
          is_electric?: boolean
          is_premium?: boolean
          is_reserved?: boolean
          notes?: string | null
          price?: number | null
          rotation?: number
          size_label?: string | null
          status?: Database["public"]["Enums"]["booth_status"]
          template_booth_id?: string | null
          updated_at?: string
          width?: number
          x?: number
          y?: number
        }
        Update: {
          assigned_application_id?: string | null
          category?: string | null
          code?: string
          created_at?: string
          event_id?: string
          height?: number
          id?: string
          is_electric?: boolean
          is_premium?: boolean
          is_reserved?: boolean
          notes?: string | null
          price?: number | null
          rotation?: number
          size_label?: string | null
          status?: Database["public"]["Enums"]["booth_status"]
          template_booth_id?: string | null
          updated_at?: string
          width?: number
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_booths_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_booths_template_booth_id_fkey"
            columns: ["template_booth_id"]
            isOneToOne: false
            referencedRelation: "layout_template_booths"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          applications_open: boolean
          cloned_from_event_id: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          is_public: boolean
          is_template: boolean
          layout_template_id: string | null
          name: string
          organization_id: string
          setup_end: string | null
          setup_start: string | null
          slug: string
          starts_at: string | null
          status: Database["public"]["Enums"]["event_status"]
          template_source_id: string | null
          updated_at: string
          venue_id: string | null
        }
        Insert: {
          applications_open?: boolean
          cloned_from_event_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_public?: boolean
          is_template?: boolean
          layout_template_id?: string | null
          name: string
          organization_id: string
          setup_end?: string | null
          setup_start?: string | null
          slug: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          template_source_id?: string | null
          updated_at?: string
          venue_id?: string | null
        }
        Update: {
          applications_open?: boolean
          cloned_from_event_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_public?: boolean
          is_template?: boolean
          layout_template_id?: string | null
          name?: string
          organization_id?: string
          setup_end?: string | null
          setup_start?: string | null
          slug?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          template_source_id?: string | null
          updated_at?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_cloned_from_event_id_fkey"
            columns: ["cloned_from_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_layout_template_id_fkey"
            columns: ["layout_template_id"]
            isOneToOne: false
            referencedRelation: "layout_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_template_source_id_fkey"
            columns: ["template_source_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      layout_template_booths: {
        Row: {
          category: string | null
          code: string
          created_at: string
          height: number
          id: string
          is_electric: boolean
          is_premium: boolean
          is_reserved: boolean
          layout_template_id: string
          notes: string | null
          price: number | null
          rotation: number
          size_label: string | null
          width: number
          x: number
          y: number
        }
        Insert: {
          category?: string | null
          code: string
          created_at?: string
          height?: number
          id?: string
          is_electric?: boolean
          is_premium?: boolean
          is_reserved?: boolean
          layout_template_id: string
          notes?: string | null
          price?: number | null
          rotation?: number
          size_label?: string | null
          width?: number
          x?: number
          y?: number
        }
        Update: {
          category?: string | null
          code?: string
          created_at?: string
          height?: number
          id?: string
          is_electric?: boolean
          is_premium?: boolean
          is_reserved?: boolean
          layout_template_id?: string
          notes?: string | null
          price?: number | null
          rotation?: number
          size_label?: string | null
          width?: number
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "layout_template_booths_layout_template_id_fkey"
            columns: ["layout_template_id"]
            isOneToOne: false
            referencedRelation: "layout_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      layout_templates: {
        Row: {
          canvas_height: number
          canvas_width: number
          created_at: string
          description: string | null
          id: string
          is_default: boolean
          name: string
          updated_at: string
          venue_id: string
        }
        Insert: {
          canvas_height?: number
          canvas_width?: number
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
          venue_id: string
        }
        Update: {
          canvas_height?: number
          canvas_width?: number
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "layout_templates_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      member_permissions: {
        Row: {
          granted_at: string
          id: string
          organization_member_id: string
          permission_key: string
        }
        Insert: {
          granted_at?: string
          id?: string
          organization_member_id: string
          permission_key: string
        }
        Update: {
          granted_at?: string
          id?: string
          organization_member_id?: string
          permission_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_permissions_organization_member_id_fkey"
            columns: ["organization_member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          channel: Database["public"]["Enums"]["message_channel"]
          created_at: string
          event_id: string | null
          id: string
          organization_id: string
          read_at: string | null
          recipient_vendor_profile_id: string | null
          sender_user_id: string | null
          thread_id: string
        }
        Insert: {
          body: string
          channel?: Database["public"]["Enums"]["message_channel"]
          created_at?: string
          event_id?: string | null
          id?: string
          organization_id: string
          read_at?: string | null
          recipient_vendor_profile_id?: string | null
          sender_user_id?: string | null
          thread_id: string
        }
        Update: {
          body?: string
          channel?: Database["public"]["Enums"]["message_channel"]
          created_at?: string
          event_id?: string | null
          id?: string
          organization_id?: string
          read_at?: string | null
          recipient_vendor_profile_id?: string | null
          sender_user_id?: string | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_recipient_vendor_profile_id_fkey"
            columns: ["recipient_vendor_profile_id"]
            isOneToOne: false
            referencedRelation: "vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          invited_at: string | null
          joined_at: string
          organization_id: string
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_at?: string | null
          joined_at?: string
          organization_id: string
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_at?: string | null
          joined_at?: string
          organization_id?: string
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_vendors: {
        Row: {
          account_status: Database["public"]["Enums"]["vendor_account_status"]
          created_at: string
          id: string
          internal_notes: string | null
          is_blacklisted: boolean
          is_favorite: boolean
          last_event_id: string | null
          needs_electricity: boolean
          organization_id: string
          preferred_booth_code: string | null
          preferred_size_label: string | null
          rating: number | null
          status: Database["public"]["Enums"]["org_vendor_status"]
          total_paid: number
          updated_at: string
          vendor_profile_id: string
          years_participated: number
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["vendor_account_status"]
          created_at?: string
          id?: string
          internal_notes?: string | null
          is_blacklisted?: boolean
          is_favorite?: boolean
          last_event_id?: string | null
          needs_electricity?: boolean
          organization_id: string
          preferred_booth_code?: string | null
          preferred_size_label?: string | null
          rating?: number | null
          status?: Database["public"]["Enums"]["org_vendor_status"]
          total_paid?: number
          updated_at?: string
          vendor_profile_id: string
          years_participated?: number
        }
        Update: {
          account_status?: Database["public"]["Enums"]["vendor_account_status"]
          created_at?: string
          id?: string
          internal_notes?: string | null
          is_blacklisted?: boolean
          is_favorite?: boolean
          last_event_id?: string | null
          needs_electricity?: boolean
          organization_id?: string
          preferred_booth_code?: string | null
          preferred_size_label?: string | null
          rating?: number | null
          status?: Database["public"]["Enums"]["org_vendor_status"]
          total_paid?: number
          updated_at?: string
          vendor_profile_id?: string
          years_participated?: number
        }
        Relationships: [
          {
            foreignKeyName: "organization_vendors_last_event_id_fkey"
            columns: ["last_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_vendors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_vendors_vendor_profile_id_fkey"
            columns: ["vendor_profile_id"]
            isOneToOne: false
            referencedRelation: "vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          slug: string
          subscription_tier: string
          suspended: boolean
          updated_at: string
          website: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          slug: string
          subscription_tier?: string
          suspended?: boolean
          updated_at?: string
          website?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          slug?: string
          subscription_tier?: string
          suspended?: boolean
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          application_id: string | null
          created_at: string
          event_id: string | null
          id: string
          marked_by: string | null
          method: string | null
          note: string | null
          organization_id: string
          paid_at: string | null
          reference: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          vendor_profile_id: string | null
        }
        Insert: {
          amount: number
          application_id?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          marked_by?: string | null
          method?: string | null
          note?: string | null
          organization_id: string
          paid_at?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          vendor_profile_id?: string | null
        }
        Update: {
          amount?: number
          application_id?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          marked_by?: string | null
          method?: string | null
          note?: string | null
          organization_id?: string
          paid_at?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          vendor_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_vendor_profile_id_fkey"
            columns: ["vendor_profile_id"]
            isOneToOne: false
            referencedRelation: "vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          category: string
          description: string
          key: string
        }
        Insert: {
          category: string
          description: string
          key: string
        }
        Update: {
          category?: string
          description?: string
          key?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          event_id: string | null
          generated_at: string
          generated_by: string | null
          id: string
          kind: string
          organization_id: string
          params: Json
          url: string | null
        }
        Insert: {
          event_id?: string | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          kind: string
          organization_id: string
          params?: Json
          url?: string | null
        }
        Update: {
          event_id?: string | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          kind?: string
          organization_id?: string
          params?: Json
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsors: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contribution: number | null
          created_at: string
          event_id: string | null
          id: string
          logo_url: string | null
          name: string
          notes: string | null
          organization_id: string
          tier: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contribution?: number | null
          created_at?: string
          event_id?: string | null
          id?: string
          logo_url?: string | null
          name: string
          notes?: string | null
          organization_id: string
          tier?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contribution?: number | null
          created_at?: string
          event_id?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          tier?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsors_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      support_requests: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          organization_id: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string | null
          event_id: string | null
          id: string
          organization_id: string
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          event_id?: string | null
          id?: string
          organization_id: string
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          event_id?: string | null
          id?: string
          organization_id?: string
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_org_prefs: {
        Row: {
          active_event_id: string | null
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_event_id?: string | null
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_event_id?: string | null
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_org_prefs_active_event_id_fkey"
            columns: ["active_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_org_prefs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendor_invitations: {
        Row: {
          accepted_at: string | null
          accepted_user_id: string | null
          code: string
          created_at: string
          email: string
          event_id: string | null
          expires_at: string | null
          id: string
          invited_by: string | null
          message: string | null
          organization_id: string
          status: Database["public"]["Enums"]["invitation_status"]
          token: string
          vendor_profile_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          code: string
          created_at?: string
          email: string
          event_id?: string | null
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          message?: string | null
          organization_id: string
          status?: Database["public"]["Enums"]["invitation_status"]
          token: string
          vendor_profile_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          code?: string
          created_at?: string
          email?: string
          event_id?: string | null
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          message?: string | null
          organization_id?: string
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
          vendor_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_invitations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_invitations_vendor_profile_id_fkey"
            columns: ["vendor_profile_id"]
            isOneToOne: false
            referencedRelation: "vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_profiles: {
        Row: {
          bio: string | null
          business_name: string
          categories: string[]
          claimed: boolean
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          phone: string | null
          updated_at: string
          user_id: string | null
          website: string | null
        }
        Insert: {
          bio?: string | null
          business_name: string
          categories?: string[]
          claimed?: boolean
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
          website?: string | null
        }
        Update: {
          bio?: string | null
          business_name?: string
          categories?: string[]
          claimed?: boolean
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
          website?: string | null
        }
        Relationships: []
      }
      venue_documents: {
        Row: {
          created_at: string
          id: string
          kind: string | null
          name: string
          url: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string | null
          name: string
          url: string
          venue_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string | null
          name?: string
          url?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_documents_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_map_references: {
        Row: {
          created_at: string
          id: string
          image_url: string
          layout_template_id: string
          locked: boolean
          offset_x: number
          offset_y: number
          opacity: number
          original_filename: string | null
          rotation: number
          scale: number
          sort_order: number
          updated_at: string
          visible: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          layout_template_id: string
          locked?: boolean
          offset_x?: number
          offset_y?: number
          opacity?: number
          original_filename?: string | null
          rotation?: number
          scale?: number
          sort_order?: number
          updated_at?: string
          visible?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          layout_template_id?: string
          locked?: boolean
          offset_x?: number
          offset_y?: number
          opacity?: number
          original_filename?: string | null
          rotation?: number
          scale?: number
          sort_order?: number
          updated_at?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "venue_map_references_layout_template_id_fkey"
            columns: ["layout_template_id"]
            isOneToOne: false
            referencedRelation: "layout_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_maps: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          sort_order: number
          updated_at: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          sort_order?: number
          updated_at?: string
          venue_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          sort_order?: number
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_maps_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          archived_at: string | null
          city: string | null
          country: string | null
          cover_image_url: string | null
          created_at: string
          emergency_info: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          organization_id: string
          parking_info: string | null
          postal_code: string | null
          state: string | null
          updated_at: string
          utilities_info: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          archived_at?: string | null
          city?: string | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string
          emergency_info?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          organization_id: string
          parking_info?: string | null
          postal_code?: string | null
          state?: string | null
          updated_at?: string
          utilities_info?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          archived_at?: string | null
          city?: string | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string
          emergency_info?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          organization_id?: string
          parking_info?: string | null
          postal_code?: string | null
          state?: string | null
          updated_at?: string
          utilities_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venues_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      event_org_id: { Args: { _event_id: string }; Returns: string }
      has_permission: {
        Args: { _org_id: string; _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_owner: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      layout_template_org_id: {
        Args: { _template_id: string }
        Returns: string
      }
      venue_org_id: { Args: { _venue_id: string }; Returns: string }
    }
    Enums: {
      app_role: "super_admin" | "organizer" | "staff" | "vendor"
      application_entry_method:
        | "manual"
        | "ai_scan"
        | "public_form"
        | "vendor_portal"
        | "imported"
      application_status:
        | "pending"
        | "approved"
        | "waitlisted"
        | "rejected"
        | "withdrawn"
        | "draft"
        | "awaiting_payment"
        | "booth_assigned"
        | "checked_in"
        | "completed"
        | "archived"
      booth_status: "available" | "held" | "assigned" | "occupied" | "blocked"
      event_status:
        | "draft"
        | "published"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "archived"
      invitation_status: "pending" | "accepted" | "expired" | "revoked"
      message_channel: "direct" | "event" | "announcement"
      org_vendor_status:
        | "prospect"
        | "invited"
        | "active"
        | "blacklisted"
        | "archived"
      payment_status: "unpaid" | "partial" | "paid" | "refunded"
      subscription_tier: "trial" | "starter" | "pro" | "enterprise"
      task_status: "open" | "in_progress" | "done" | "cancelled"
      vendor_account_status:
        | "no_account"
        | "invited"
        | "registered"
        | "disabled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "organizer", "staff", "vendor"],
      application_entry_method: [
        "manual",
        "ai_scan",
        "public_form",
        "vendor_portal",
        "imported",
      ],
      application_status: [
        "pending",
        "approved",
        "waitlisted",
        "rejected",
        "withdrawn",
        "draft",
        "awaiting_payment",
        "booth_assigned",
        "checked_in",
        "completed",
        "archived",
      ],
      booth_status: ["available", "held", "assigned", "occupied", "blocked"],
      event_status: [
        "draft",
        "published",
        "in_progress",
        "completed",
        "cancelled",
        "archived",
      ],
      invitation_status: ["pending", "accepted", "expired", "revoked"],
      message_channel: ["direct", "event", "announcement"],
      org_vendor_status: [
        "prospect",
        "invited",
        "active",
        "blacklisted",
        "archived",
      ],
      payment_status: ["unpaid", "partial", "paid", "refunded"],
      subscription_tier: ["trial", "starter", "pro", "enterprise"],
      task_status: ["open", "in_progress", "done", "cancelled"],
      vendor_account_status: [
        "no_account",
        "invited",
        "registered",
        "disabled",
      ],
    },
  },
} as const
