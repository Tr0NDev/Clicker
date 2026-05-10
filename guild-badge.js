(function () {
  const SUPABASE_URL = 'https://vrozpjdyqerpcrwlcdfo.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_moV-dfu5sVohSbQOR6z0zw_BSpcVCHg';
  const ONLINE_WINDOW_MS = 3 * 60 * 1000;
  const MEMBERSHIP_KEY = 'clicker_guildMembership';
  const USER_ID_KEY = 'clicker_userId';

  const supabaseBaseUrl = `${SUPABASE_URL}/rest/v1`;

  function getPlayerId() {
    return localStorage.getItem(USER_ID_KEY) || null;
  }

  function getMembership() {
    try {
      const raw = localStorage.getItem(MEMBERSHIP_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function getGuildButton() {
    return Array.from(document.querySelectorAll('button.nav-button, button')).find((button) => {
      const label = (button.textContent || '').replace(/\s+/g, ' ').trim();
      return label === 'Guild' || label.startsWith('Guild ');
    }) || null;
  }

  function ensureBadge(button) {
    if (!button) return null;
    button.style.display = 'inline-flex';
    button.style.alignItems = 'center';
    button.style.gap = '6px';
    let badge = button.querySelector('[data-guild-online-indicator]');
    if (badge) return badge;

    badge = document.createElement('span');
    badge.dataset.guildOnlineIndicator = 'true';
    badge.style.display = 'none';
    badge.style.alignItems = 'center';
    badge.style.gap = '6px';
    badge.style.marginLeft = '8px';
    badge.style.padding = '1px 8px';
    badge.style.borderRadius = '999px';
    badge.style.border = '1px solid rgba(34, 122, 62, 0.5)';
    badge.style.background = 'rgba(28, 88, 48, 0.2)';
    badge.style.color = '#2f8f4e';
    badge.style.fontSize = '12px';
    badge.style.fontWeight = 'bold';
    badge.style.lineHeight = '1.2';
    badge.style.flex = '0 0 auto';

    const dot = document.createElement('span');
    dot.style.width = '8px';
    dot.style.height = '8px';
    dot.style.borderRadius = '50%';
    dot.style.background = '#2fd468';
    dot.style.boxShadow = '0 0 8px rgba(47, 212, 104, 0.6)';
    dot.style.display = 'inline-block';
    dot.style.flex = '0 0 auto';

    const count = document.createElement('span');
    count.dataset.guildOnlineCount = 'true';
    count.textContent = '0';

    badge.appendChild(dot);
    badge.appendChild(count);
    button.appendChild(badge);
    return badge;
  }

  async function updateMyPresence() {
    const pid = getPlayerId();
    if (!pid) return;

    await fetch(`${supabaseBaseUrl}/profiles?player_id=eq.${encodeURIComponent(pid)}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({ updated_at: new Date().toISOString() })
    });
  }

  async function updateGuildBadge() {
    const button = getGuildButton();
    if (!button) return;
    const badge = ensureBadge(button);
    if (!badge) return;

    const pid = getPlayerId();
    const membership = getMembership();
    if (!pid || !membership || !membership.guildId) {
      badge.style.display = 'none';
      return;
    }

    try {
      const guildUrl = new URL(`${supabaseBaseUrl}/guilds`);
      guildUrl.searchParams.set('select', 'members');
      guildUrl.searchParams.set('id', `eq.${membership.guildId}`);

      const guildResponse = await fetch(guildUrl, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Accept: 'application/json'
        }
      });
      const guildRows = await guildResponse.json();
      const guild = Array.isArray(guildRows) ? guildRows[0] : null;

      if (!guild) {
        badge.style.display = 'none';
        return;
      }

      const members = Array.isArray(guild.members)
        ? guild.members
        : JSON.parse(guild.members || '[]');
      const memberIds = members.map((member) => member && member.pid).filter(Boolean);
      if (!memberIds.length) {
        badge.style.display = 'none';
        return;
      }

      const profilesUrl = new URL(`${supabaseBaseUrl}/profiles`);
      profilesUrl.searchParams.set('select', 'player_id,updated_at');
      profilesUrl.searchParams.set('player_id', `in.(${memberIds.map((id) => `"${String(id).replace(/"/g, '\\"')}"`).join(',')})`);

      const profilesResponse = await fetch(profilesUrl, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Accept: 'application/json'
        }
      });
      const profiles = await profilesResponse.json();

      if (!Array.isArray(profiles)) {
        badge.style.display = 'none';
        return;
      }

      const now = Date.now();
      const onlineCount = profiles.reduce((count, profile) => {
        const updatedAt = profile && profile.updated_at ? Date.parse(profile.updated_at) : NaN;
        return Number.isFinite(updatedAt) && now - updatedAt <= ONLINE_WINDOW_MS ? count + 1 : count;
      }, 0);

      const countEl = badge.querySelector('[data-guild-online-count]');
      if (countEl) countEl.textContent = String(onlineCount);
      badge.style.display = 'inline-flex';
    } catch {
      badge.style.display = 'none';
    }
  }

  async function refreshGuildBadge() {
    try {
      await updateMyPresence();
    } catch {}

    try {
      await updateGuildBadge();
    } catch {}
  }

  function schedule() {
    refreshGuildBadge();
    setInterval(refreshGuildBadge, 60000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule, { once: true });
  } else {
    schedule();
  }
})();