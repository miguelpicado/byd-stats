import { useState, useCallback, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, TrendingUp, Clock, Zap, BarChart3, List, Battery, Calendar } from '../components/Icons';
import { Settings } from '@/types';

interface Tab {
    id: string;
    label: string;
    icon: any; // Icon component type
}

interface UseTabNavigationProps {
    settings: Settings;
}

export const useTabNavigation = ({ settings }: UseTabNavigationProps) => {
    const { t } = useTranslation();

    // Initial tab from URL hash or default 'overview'
    const getInitialTab = (): string => {
        const hash = window.location.hash.replace('#', '');
        const validTabs = ['overview', 'calendar', 'trends', 'patterns', 'efficiency', 'records', 'history', 'charges'];
        return validTabs.includes(hash) ? hash : 'overview';
    };

    const [activeTab, setActiveTab] = useState<string>(getInitialTab);
    const [fadingTab, setFadingTab] = useState<string | null>(null);
    const [isTransitioning, setIsTransitioning] = useState<boolean>(false);

    // Constants
    const transitionDuration = 500;

    const tabs: Tab[] = useMemo(() => [
        { id: 'overview', label: t('tabs.overview'), icon: Activity },
        { id: 'calendar', label: t('tabs.calendar'), icon: Calendar },
        { id: 'trends', label: t('tabs.trends'), icon: TrendingUp },
        { id: 'patterns', label: t('tabs.patterns'), icon: Clock },
        { id: 'efficiency', label: t('tabs.efficiency'), icon: Zap },
        { id: 'records', label: t('tabs.records'), icon: BarChart3 },
        { id: 'history', label: t('tabs.history'), icon: List },
        { id: 'charges', label: t('tabs.charges'), icon: Battery }
    ].filter(t => t.id === 'overview' || !(settings.hiddenTabs || []).includes(t.id as any)), [t, settings.hiddenTabs]);

    // Handle browser back/forward buttons
    useEffect(() => {
        const handlePopState = () => {
            const hash = window.location.hash.replace('#', '');
            const validTabs = tabs.map(t => t.id);
            const newTab = validTabs.includes(hash) ? hash : 'overview';

            if (newTab !== activeTab) {
                setActiveTab(newTab);
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [activeTab, tabs]);

    // Sync state changes to URL
    useEffect(() => {
        const currentHash = window.location.hash.replace('#', '');
        if (currentHash !== activeTab) {
            // Use replaceState if initial load to avoid pushing 'overview' history if generic
            if (activeTab === 'overview' && !currentHash) {
                window.history.replaceState(null, '', `/#${activeTab}`);
            } else {
                window.history.pushState(null, '', `/#${activeTab}`);
            }
        }
    }, [activeTab]);

    const handleTabClick = useCallback((tabId: string) => {
        if (tabId === activeTab) return;
        if (isTransitioning) return;

        // Use transitions for both vertical and horizontal modes
        setIsTransitioning(true);
        setActiveTab(tabId);
        setFadingTab(tabId); // Mark this tab for fade-in animation

        setTimeout(() => {
            setIsTransitioning(false);
            setFadingTab(null); // Clear animation after transition
        }, transitionDuration);
    }, [activeTab, isTransitioning, transitionDuration]);

    return {
        activeTab,
        setActiveTab,
        fadingTab,
        isTransitioning, // Exposed for MainLayout or other consumers
        handleTabClick,
        tabs
    };
};
