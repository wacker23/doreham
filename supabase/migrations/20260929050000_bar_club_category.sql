-- Night Out gets its own venue category (Sophia, Sep 29 2026).
alter type public.venue_category add value if not exists 'bar_club';
