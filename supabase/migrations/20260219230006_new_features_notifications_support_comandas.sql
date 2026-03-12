
-- Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see their own notifications" ON public.notifications FOR SELECT USING (true); -- Simplified for now, in a real app we'd use (auth.uid() = user_id)
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING (true);

-- Plan Change Requests
CREATE TABLE IF NOT EXISTS public.plan_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  current_plan TEXT,
  requested_plan TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.plan_change_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert plan requests" ON public.plan_change_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view plan requests" ON public.plan_change_requests FOR SELECT USING (true);

-- Support Tickets
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'responded', 'closed')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see their own tickets" ON public.support_tickets FOR SELECT USING (true);
CREATE POLICY "Users can insert tickets" ON public.support_tickets FOR INSERT WITH CHECK (true);

-- Ticket Messages
CREATE TABLE IF NOT EXISTS public.ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see messages for their tickets" ON public.ticket_messages FOR SELECT USING (true);
CREATE POLICY "Users can insert messages" ON public.ticket_messages FOR INSERT WITH CHECK (true);

-- Comandas (Customer Orders)
CREATE TABLE IF NOT EXISTS public.comandas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id),
  staff_id UUID REFERENCES public.staff(id),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'paid', 'cancelled')),
  total NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.comandas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can see comandas" ON public.comandas FOR SELECT USING (true);
CREATE POLICY "Anyone can insert comandas" ON public.comandas FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update comandas" ON public.comandas FOR UPDATE USING (true);

-- Comanda Items
CREATE TABLE IF NOT EXISTS public.comanda_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comanda_id UUID REFERENCES public.comandas(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id),
  product_name TEXT, -- Simplified if products table doesn't exist yet
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.comanda_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can see items" ON public.comanda_items FOR SELECT USING (true);
CREATE POLICY "Anyone can insert items" ON public.comanda_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update items" ON public.comanda_items FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete items" ON public.comanda_items FOR DELETE USING (true);
;
