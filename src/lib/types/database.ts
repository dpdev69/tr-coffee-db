export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface CoffeeBrewRecipe {
  method: string;
  dose_grams: number | null;
  water_grams: number | null;
  yield_grams: number | null;
  ratio: string | null;
  grind: string | null;
  water_temp_c: string | null;
  brew_time: string | null;
  steps: string[];
  note: string | null;
  source: 'product_page' | 'adapter';
  source_text: string;
}

export interface Database {
  public: {
    Tables: {
      roasters: {
        Row: {
          id: string;
          slug: string;
          name: string;
          website_url: string;
          shop_url: string;
          logo_url: string | null;
          city: string | null;
          description: string | null;
          platform: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['roasters']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['roasters']['Insert']>;
      };
      coffees: {
        Row: {
          id: string;
          roaster_id: string;
          slug: string;
          external_id: string;
          name: string;
          name_normalized: string | null;
          origin_country: string | null;
          origin_region: string | null;
          origin_farm: string | null;
          origin_altitude: string | null;
          origin_producer: string | null;
          process: string;
          process_detail: string | null;
          roast_level: string;
          variety: string | null;
          harvest_year: string | null;
          roast_date: string | null;
          flavor_notes: string[];
          flavor_notes_normalized: string[];
          flavor_categories: string[];
          sca_score: number | null;
          price_amount: number | null;
          price_currency: string;
          weight_grams: number | null;
          price_per_100g: number | null;
          product_url: string;
          image_url: string | null;
          is_available: boolean;
          is_decaf: boolean;
          brew_methods: string[];
          brew_recipes: CoffeeBrewRecipe[];
          click_count: number;
          last_scraped_at: string | null;
          last_seen_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['coffees']['Row'], 'id' | 'created_at' | 'updated_at' | 'click_count'>;
        Update: Partial<Database['public']['Tables']['coffees']['Insert']>;
      };
      scrape_logs: {
        Row: {
          id: string;
          roaster_id: string | null;
          started_at: string;
          completed_at: string | null;
          status: string;
          products_found: number;
          products_upserted: number;
          error_message: string | null;
          duration_ms: number | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['scrape_logs']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['scrape_logs']['Insert']>;
      };
      redirect_events: {
        Row: {
          id: string;
          coffee_id: string;
          roaster_id: string;
          source: string;
          filter_context: Json | null;
          quiz_context: Json | null;
          page_path: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['redirect_events']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['redirect_events']['Insert']>;
      };
      correction_reports: {
        Row: {
          id: string;
          coffee_id: string | null;
          roaster_id: string | null;
          issue_type: string;
          reporter_email: string;
          message: string;
          source_path: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['correction_reports']['Row'], 'id' | 'status' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Database['public']['Tables']['correction_reports']['Row'], 'id' | 'created_at' | 'updated_at'>>;
      };
    };
    Functions: {
      increment_click: {
        Args: { coffee_id: string };
        Returns: void;
      };
      get_filter_options: {
        Args: Record<string, never>;
        Returns: {
          countries: string[];
          processes: string[];
          roast_levels: string[];
          roasters: { id: string; name: string; slug: string }[];
          price_range: { min: number; max: number };
          total_coffees: number;
        };
      };
      search_coffees: {
        Args: { query: string };
        Returns: Database['public']['Tables']['coffees']['Row'][];
      };
    };
  };
}

export type Coffee = Database['public']['Tables']['coffees']['Row'];
export type Roaster = Database['public']['Tables']['roasters']['Row'];
export type CoffeeWithRoaster = Coffee & { roasters: Pick<Roaster, 'name' | 'slug' | 'city'> };
