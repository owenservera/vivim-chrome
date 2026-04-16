export const PROVIDER_ICONS = {
  chatgpt: {
    id: 'chatgpt',
    name: 'ChatGPT',
    color: '#10a37f',
    icon: 'icons/providers/chatgpt.svg',
    domains: ['chatgpt.com', 'chat.com']
  },
  claude: {
    id: 'claude',
    name: 'Claude',
    color: '#d4a574',
    icon: 'icons/providers/claude.svg',
    domains: ['claude.ai']
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    color: '#4285f4',
    icon: 'icons/providers/gemini.svg',
    domains: ['gemini.google.com']
  }
};

export function getProviderIconByDomain(domain) {
  for (const provider of Object.values(PROVIDER_ICONS)) {
    if (provider.domains.some(d => domain.includes(d))) {
      return provider.icon;
    }
  }
  return null;
}

export function getProviderInfoByDomain(domain) {
  for (const provider of Object.values(PROVIDER_ICONS)) {
    if (provider.domains.some(d => domain.includes(d))) {
      return provider;
    }
  }
  return null;
}

export function getAllProviderIds() {
  return Object.keys(PROVIDER_ICONS);
}

export function getProviderById(id) {
  return PROVIDER_ICONS[id] || null;
}