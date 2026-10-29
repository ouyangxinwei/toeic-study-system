/**
 * Supabase 浏览器客户端配置。请填写 Project URL 与 publishable/anon key。
 * 禁止将 service_role/secret key 放在浏览器端。
 */
window.TOEIC_SUPABASE_CONFIG = {
  url: 'https://vnbzskrkelhnecgqykhy.supabase.co',
  key: 'sb_publishable_lD1SEGPoM5kW0sYRpNYUww_2aA1Bj8h'
};
window.toeicSupabase = null;
window.toeicSupabaseReady = false;
window.toeicSupabaseError = null;
(function initSupabaseClient() {
  const config = window.TOEIC_SUPABASE_CONFIG || {};
  if (!config.url || !config.key || config.url.includes('YOUR_PROJECT_ID') || config.key.includes('YOUR_SUPABASE')) {
    window.toeicSupabaseError = '尚未配置 Supabase URL 和 publishable/anon key';
    console.info('[Supabase] 尚未配置，系统暂时使用本地数据。请编辑 js/supabase-client.js。');
    return;
  }
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    window.toeicSupabaseError = 'Supabase SDK 加载失败，请检查网络/CDN';
    console.error('[Supabase]', window.toeicSupabaseError);
    return;
  }
  try {
    window.toeicSupabase = window.supabase.createClient(config.url, config.key);
    window.toeicSupabaseReady = true;
  } catch (error) {
    window.toeicSupabaseError = error.message || String(error);
    console.error('[Supabase] 初始化失败:', error);
  }
})();
