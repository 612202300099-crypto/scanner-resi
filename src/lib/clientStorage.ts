export interface AppConfig {
    scriptWebUrl: string;
    sheetName: string;
    targetColumn: string;
    dailyTarget: number;
}

export const getClientConfig = (): AppConfig => {
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('scanner_config_v2');
        if (saved) return JSON.parse(saved);
    }
    return { scriptWebUrl: '', sheetName: 'Sheet1', targetColumn: 'A', dailyTarget: 100 };
};

export const saveClientConfig = (config: AppConfig) => {
    if (typeof window !== 'undefined') {
        localStorage.setItem('scanner_config_v2', JSON.stringify(config));
    }
};
