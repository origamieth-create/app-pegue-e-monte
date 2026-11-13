// =====================================================================
// Configuração do App Pegue e Monte
// Cole aqui os dois valores do seu projeto no Supabase:
// Supabase > Project Settings > API
// =====================================================================

// "Project URL", algo como https://abcdefgh.supabase.co
export const SUPABASE_URL = 'DEMONSTRACAO';

// "anon public" (essa chave pode ficar no site; NUNCA cole a "service_role" aqui)
export const SUPABASE_ANON_KEY = '';

// Deixa a compradora criar a conta na tela de login (com o mesmo e-mail da compra).
// Quem cria a conta sem ter comprado ganha 7 dias de teste grátis (uma vez por e-mail).
export const PERMITIR_CADASTRO = true;

// E-mail que aparece no botão de ajuda do app.
export const EMAIL_SUPORTE = 'apppegueemonte@gmail.com';

// WhatsApp do suporte, com DDD (ex.: '11999990000'). Vazio = o botão não aparece.
export const WHATSAPP_SUPORTE = '51982316117';

// Links de pagamento da Cakto (usados no aviso de pagamento e na tela de assinatura)
export const LINK_MENSAL = 'https://pay.cakto.com.br/3bnawbt_1255298';
export const LINK_ANUAL = 'https://pay.cakto.com.br/65irjr2';

// Demonstração pública no site (pegueemonte.com/demo). Deixe false no app de verdade.
export const DEMO_SITE = false;
// Para onde vai o botão "Quero assinar" da demonstração.
export const LINK_PLANOS = 'https://pegueemonte.com/#precos';
