// theme.config.ts
export interface ThemeConfig {
  colors: {
    primary: string;
    primaryHover: string;
    primaryActive: string;
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  typography: {
    fontSizeBase: string;
    fontSizeLg: string;
    fontSizeSm: string;
    fontFamily: string;
  };
  spacing: {
    paddingBase: string;
    marginBase: string;
  };
  border: {
    radiusBase: string;
    widthBase: string;
  };
  component: {
    button: ButtonConfig;
    input: InputConfig;
    table: TableConfig;
    modal: ModalConfig;
  };
}

export interface ButtonConfig {
  height: string;
  paddingHorizontal: string;
  fontWeight: string;
  textTransform: string;
}

export interface InputConfig {
  height: string;
  borderColor: string;
  focusBorderColor: string;
  focusShadow: string;
}

export interface TableConfig {
  headerBg: string;
  headerColor: string;
  rowHoverBg: string;
  borderColor: string;
}

export interface ModalConfig {
  headerBg: string;
  borderRadius: string;
}

export const DEFAULT_THEME: ThemeConfig = {
  colors: {
    primary: '#189952',
    primaryHover: '#40a9ff',
    primaryActive: '#096dd9',
    success: '#52c41a',
    warning: '#faad14',
    error: '#f5222d',
    info: '#1890ff'
  },
  typography: {
    fontSizeBase: '14px',
    fontSizeLg: '16px',
    fontSizeSm: '12px',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial"
  },
  spacing: {
    paddingBase: '16px',
    marginBase: '16px'
  },
  border: {
    radiusBase: '2px',
    widthBase: '1px'
  },
  component: {
    button: {
      height: '32px',
      paddingHorizontal: '16px',
      fontWeight: '400',
      textTransform: 'none'
    },
    input: {
      height: '32px',
      borderColor: '#d9d9d9',
      focusBorderColor: '#40a9ff',
      focusShadow: '0 0 0 2px rgba(24, 144, 255, 0.2)'
    },
    table: {
      headerBg: '#fafafa',
      headerColor: 'rgba(0, 0, 0, 0.85)',
      rowHoverBg: '#e6f7ff',
      borderColor: '#f0f0f0'
    },
    modal: {
      headerBg: '#ffffff',
      borderRadius: '2px'
    }
  }
};