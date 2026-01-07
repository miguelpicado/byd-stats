// BYD Stats - GitHub Footer Component

import React from 'react';
import { GitHub } from '../icons';

/**
 * Footer component with GitHub repository link
 */
const GitHubFooter = React.memo(() => (
    <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700/50">
        <a
            href="https://github.com/miguelpicado/byd-stats"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors mx-auto w-fit"
        >
            <GitHub className="w-5 h-5" />
            <span>Ver en GitHub</span>
        </a>
    </div>
));

GitHubFooter.displayName = 'GitHubFooter';

export default GitHubFooter;
