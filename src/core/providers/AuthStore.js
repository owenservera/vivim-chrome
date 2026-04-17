export class BaseAuthStore {
  constructor() {
    this.updatedAt = null;
  }

  touch() {
    this.updatedAt = Date.now();
  }

  getLatest() {
    return { updatedAt: this.updatedAt };
  }

  isValid(authData) {
    return authData && Object.keys(authData).length > 0;
  }

  clear() {
    this.updatedAt = null;
  }
}

export function createAuthStore(primaryKey, ...extraKeys) {
  return class extends BaseAuthStore {
    constructor() {
      super();
      this[primaryKey] = null;
      extraKeys.forEach(key => {
        this[key] = null;
      });
    }

    setPrimary(value) {
      if (value) {
        this[primaryKey] = value;
        this.touch();
      }
    }

    setExtra(key, value) {
      if (key && value) {
        this[key] = value;
        this.touch();
      }
    }

    setMultiple(data) {
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          this[key] = value;
        }
      });
      this.touch();
    }

    getLatest() {
      const data = { updatedAt: this.updatedAt };
      data[primaryKey] = this[primaryKey];
      extraKeys.forEach(key => {
        if (this[key] !== null && this[key] !== undefined) {
          data[key] = this[key];
        }
      });
      if (!data[primaryKey] && extraKeys.length === 0) {
        return { updatedAt: this.updatedAt };
      }
      return data;
    }

    isValid() {
      return this[primaryKey] !== null && this[primaryKey] !== undefined;
    }
  };
}

export function createMultiTokenAuthStore(...keys) {
  return class extends BaseAuthStore {
    constructor() {
      super();
      keys.forEach(key => {
        this[key] = null;
      });
    }

    setTokens(data) {
      keys.forEach(key => {
        if (data[key] !== undefined && data[key] !== null) {
          this[key] = data[key];
        }
      });
      this.touch();
    }

    setMultiple(data) {
      Object.entries(data).forEach(([key, value]) => {
        if (keys.includes(key) && value !== undefined && value !== null) {
          this[key] = value;
        }
      });
      this.touch();
    }

    getLatest() {
      const data = { updatedAt: this.updatedAt };
      keys.forEach(key => {
        if (this[key] !== null && this[key] !== undefined) {
          data[key] = this[key];
        }
      });
      return data;
    }

    isValid() {
      return keys.some(key => this[key] !== null && this[key] !== undefined);
    }
  };
}