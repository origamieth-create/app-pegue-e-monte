// =====================================================================
// Configuração do App Pegue e Monte
// Cole aqui os dois valores do seu projeto no Supabase:
// Supabase > Project Settings > API
// =====================================================================

// "Project URL", algo como https://abcdefgh.supabase.co
export const SUPABASE_URL = 'https://qjezuqbxcvcvqhkbrugb.supabase.co';

// "anon public" (essa chave pode ficar no site; NUNCA cole a "service_role" aqui)
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqZXp1cWJ4Y3ZjdnFoa2JydWdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyMDg3MjIsImV4cCI6MjEwODc4NDcyMn0.vv1yoEFNiTrj4sz4hk50-fK08XhX4WJ47nPNtkYMTcg';

// Deixa a compradora criar a conta na tela de login (com o mesmo e-mail da compra).
// Quem não tem assinatura cria a conta, mas não consegue usar o app.
export const PERMITIR_CADASTRO = true;

// E-mail que aparece no botão de ajuda do app.
export const EMAIL_SUPORTE = 'origami.eth@gmail.com';

// Links de pagamento da Cakto (usados no aviso de pagamento e na tela de assinatura)
export const LINK_MENSAL = 'https://pay.cakto.com.br/3bnawbt_1255298';
export const LINK_ANUAL = 'https://pay.cakto.com.br/65irjr2';
