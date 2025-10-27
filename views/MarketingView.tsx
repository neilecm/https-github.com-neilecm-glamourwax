// views/MarketingView.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { metaService } from '../services/metaService';
import type { MetaAdAccount, MetaCampaign } from '../types';
import Spinner from '../components/Spinner';

const META_TOKEN_KEY = 'meta_access_token';

// A simple toggle switch component
const ToggleSwitch: React.FC<{ checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean; }> = ({ checked, onChange, disabled }) => (
    <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" disabled={disabled} />
        <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-500"></div>
    </label>
);

const MarketingView: React.FC = () => {
    const [isSdkReady, setIsSdkReady] = useState(false);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [adAccount, setAdAccount] = useState<MetaAdAccount | null>(null);
    const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Initialize the Facebook SDK on component mount
    useEffect(() => {
        metaService.initFacebookSdk().then(() => {
            setIsSdkReady(true);
            const storedToken = localStorage.getItem(META_TOKEN_KEY);
            if (storedToken) {
                setAccessToken(storedToken);
            } else {
                setIsLoading(false);
            }
        });
    }, []);

    // Fetch marketing data when the access token is available
    const fetchMarketingData = useCallback(async (token: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const adAccountsResponse = await metaService.getAdAccounts(token);
            const firstAdAccount = adAccountsResponse.data?.[0];
            if (!firstAdAccount) {
                throw new Error("No ad accounts found for this user.");
            }
            setAdAccount(firstAdAccount);

            const campaignsResponse = await metaService.getCampaigns(token, firstAdAccount.id);
            // Fetch insights for all campaigns
            const campaignIds = campaignsResponse.data.map((c: MetaCampaign) => c.id);
            const insightsResponse = await metaService.getCampaignInsights(token, campaignIds);

            // This is a simplified merge. The mock insights API doesn't filter by ID,
            // so we'll just assign the first insight to the first campaign, etc. for demonstration.
            const campaignsWithInsights = campaignsResponse.data.map((campaign: MetaCampaign, index: number) => ({
                ...campaign,
                insights: insightsResponse.data?.[index]
            }));

            setCampaigns(campaignsWithInsights);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch marketing data.');
            // If token is invalid, clear it
            if (err.message.includes('Invalid OAuth access token')) {
                handleDisconnect();
            }
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (accessToken) {
            fetchMarketingData(accessToken);
        }
    }, [accessToken, fetchMarketingData]);
    
    const handleConnect = async () => {
        if (!isSdkReady) {
            setError("Meta SDK is not ready yet. Please wait a moment and try again.");
            return;
        }
        setIsLoading(true);
        try {
            const token = await metaService.login();
            localStorage.setItem(META_TOKEN_KEY, token);
            setAccessToken(token);
        } catch (err: any) {
            setError(err.message || 'Failed to connect to Facebook.');
            setIsLoading(false);
        }
    };
    
    const handleDisconnect = () => {
        localStorage.removeItem(META_TOKEN_KEY);
        setAccessToken(null);
        setAdAccount(null);
        setCampaigns([]);
        setError(null);
    };

    const handleStatusToggle = async (campaignId: string, newStatus: boolean) => {
        const status = newStatus ? 'ACTIVE' : 'PAUSED';
        
        // Optimistic UI update
        const originalCampaigns = campaigns;
        setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, status } : c));

        try {
            if(!accessToken) throw new Error("Not authenticated");
            await metaService.updateCampaignStatus(accessToken, campaignId, status);
        } catch (err: any) {
            setError(err.message || "Failed to update campaign status.");
            // Revert on failure
            setCampaigns(originalCampaigns);
        }
    };

    // Render loading state while SDK initializes
    if (!isSdkReady && !accessToken) {
        return <Spinner />;
    }

    // Render connect button if not authenticated
    if (!accessToken) {
        return (
            <div className="text-center bg-gray-50 p-12 rounded-lg border-dashed border-2">
                <h2 className="text-2xl font-semibold text-gray-700 mb-2">Connect to Meta</h2>
                <p className="text-gray-500 mb-6">Authorize this application to view and manage your ad campaigns.</p>
                {error && <div className="text-red-500 bg-red-100 p-3 rounded-md mb-4">{error}</div>}
                <button
                    onClick={handleConnect}
                    disabled={isLoading}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center mx-auto disabled:bg-blue-300"
                >
                    {isLoading ? <Spinner /> : 'Connect with Facebook'}
                </button>
                 <p className="text-xs text-gray-400 mt-4">
                    Note: You must configure your Meta App ID in <strong>services/metaService.ts</strong> for this to work.
                 </p>
            </div>
        );
    }
    
    // Render the main dashboard if connected
    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h2 className="text-2xl font-semibold">Marketing Dashboard</h2>
                    {adAccount && <p className="text-sm text-gray-500">Connected to Ad Account: <strong>{adAccount.name}</strong> ({adAccount.id})</p>}
                </div>
                <button onClick={handleDisconnect} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-300">
                    Disconnect
                </button>
            </div>

            {error && <div className="text-red-500 bg-red-100 p-4 rounded-lg my-4">{error}</div>}
            {isLoading ? <Spinner /> : (
                 <div className="overflow-x-auto">
                    <table className="min-w-full bg-white text-sm">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="py-3 px-4 text-left font-semibold">Campaign</th>
                                <th className="py-3 px-4 text-left font-semibold">Status</th>
                                <th className="py-3 px-4 text-left font-semibold">Spend</th>
                                <th className="py-3 px-4 text-left font-semibold">Impressions</th>
                                <th className="py-3 px-4 text-left font-semibold">Clicks</th>
                            </tr>
                        </thead>
                        <tbody>
                            {campaigns.map(campaign => (
                                <tr key={campaign.id} className="border-b hover:bg-gray-50">
                                    <td className="py-3 px-4">
                                        <div className="font-medium">{campaign.name}</div>
                                        <div className="text-gray-500 text-xs">Objective: {campaign.objective}</div>
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2">
                                            <ToggleSwitch 
                                                checked={campaign.status === 'ACTIVE'} 
                                                onChange={(isChecked) => handleStatusToggle(campaign.id, isChecked)}
                                            />
                                            <span className={`font-semibold ${campaign.status === 'ACTIVE' ? 'text-green-600' : 'text-gray-500'}`}>
                                                {campaign.status}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4">Rp{parseFloat(campaign.insights?.spend || '0').toLocaleString('id-ID')}</td>
                                    <td className="py-3 px-4">{parseInt(campaign.insights?.impressions || '0').toLocaleString('id-ID')}</td>
                                    <td className="py-3 px-4">{parseInt(campaign.insights?.clicks || '0').toLocaleString('id-ID')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {campaigns.length === 0 && <p className="text-center py-8 text-gray-500">No campaigns found in this ad account.</p>}
                </div>
            )}
        </div>
    );
};

export default MarketingView;
