// ContentReplicator.jsx - VERSION COMPLÈTE AVEC BOUTON COPIER
import React, { useState } from 'react';
import { 
  X, Copy, Share2, Calendar, TrendingUp, Download,
  Video, FileText, Image, MessageSquare, Instagram,
  Twitter, Linkedin, Facebook, Youtube, Plus
} from 'lucide-react';
import { CopyButton } from './components/common/CopyButton';

const platformIcons = {
  twitter: Twitter,
  linkedin: Linkedin,
  facebook: Facebook,
  instagram: Instagram,
  youtube: Youtube
};

const defaultMasterContent = [
  {
    id: 1,
    title: "Comment gérer son cashflow en startup",
    type: "video",
    duration: "12 min",
    createdDate: "2025-01-15",
    reach: 15420,
    engagement: 8.5,
    derivatives: [
      { platform: "youtube", type: "Long-form", status: "published", reach: 8500 },
      { platform: "instagram", type: "Reels (3)", status: "published", reach: 3200 },
      { platform: "linkedin", type: "Article", status: "published", reach: 2100 },
      { platform: "twitter", type: "Thread", status: "published", reach: 1620 }
    ]
  },
  {
    id: 2,
    title: "Les 7 métriques financières à suivre",
    type: "article",
    duration: "8 min lecture",
    createdDate: "2025-01-10",
    reach: 8900,
    engagement: 12.3,
    derivatives: [
      { platform: "linkedin", type: "Carrousel", status: "published", reach: 4200 },
      { platform: "twitter", type: "Thread", status: "published", reach: 2800 },
      { platform: "instagram", type: "Posts (7)", status: "scheduled", reach: 0 },
      { platform: "facebook", type: "Post", status: "draft", reach: 0 }
    ]
  }
];

export function ContentReplicator({ onClose }) {
  const [masterContent, setMasterContent] = useState(defaultMasterContent);
  const [showNewContent, setShowNewContent] = useState(false);
  const [selectedContent, setSelectedContent] = useState(null);

  const totalStats = {
    masterPieces: masterContent.length,
    derivatives: masterContent.reduce((sum, c) => sum + c.derivatives.length, 0),
    totalReach: masterContent.reduce((sum, c) => sum + c.reach, 0),
    avgEngagement: (masterContent.reduce((sum, c) => sum + c.engagement, 0) / masterContent.length).toFixed(1)
  };

  // ✅ Fonction pour générer le texte à copier
  const generateCopyText = () => {
    const now = new Date().toLocaleDateString('fr-FR', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });

    let text = `🎯 CONTENT REPLICATOR\n`;
    text += `═══════════════════════════════════════════════\n`;
    text += `Date: ${now}\n`;
    text += `Attention is leverage • Multiply reach\n`;
    text += `\n`;

    // KPIs Globaux
    text += `📊 STATISTIQUES GLOBALES\n`;
    text += `───────────────────────────────────────────────\n`;
    text += `Contenus Maîtres:      ${totalStats.masterPieces}\n`;
    text += `Déclinaisons totales:  ${totalStats.derivatives}\n`;
    text += `Reach Total:           ${totalStats.totalReach.toLocaleString()}\n`;
    text += `Engagement Moyen:      ${totalStats.avgEngagement}%\n`;
    text += `Taux Réplication:      ${(totalStats.derivatives / totalStats.masterPieces).toFixed(1)} déclinaisons/contenu\n`;
    text += `\n`;

    // Détail par contenu
    text += `📝 CONTENUS MAÎTRES\n`;
    text += `───────────────────────────────────────────────\n`;
    masterContent.forEach((content, idx) => {
      text += `\n${idx + 1}. ${content.title}\n`;
      text += `   Type: ${content.type === 'video' ? '🎥 Vidéo' : '📄 Article'} (${content.duration})\n`;
      text += `   Créé le: ${new Date(content.createdDate).toLocaleDateString('fr-FR')}\n`;
      text += `   Reach: ${content.reach.toLocaleString()} | Engagement: ${content.engagement}%\n`;
      text += `   Déclinaisons: ${content.derivatives.length}\n`;
      text += `\n   Détail des déclinaisons:\n`;
      
      content.derivatives.forEach(derivative => {
        const statusEmoji = derivative.status === 'published' ? '✅' : 
                           derivative.status === 'scheduled' ? '⏰' : '📝';
        text += `   ${statusEmoji} ${derivative.platform.toUpperCase()} - ${derivative.type}\n`;
        if (derivative.reach > 0) {
          text += `      Reach: ${derivative.reach.toLocaleString()} vues\n`;
        } else {
          text += `      Statut: ${derivative.status}\n`;
        }
      });
    });
    text += `\n`;

    // Performance par plateforme
    const platformStats = {};
    masterContent.forEach(content => {
      content.derivatives.forEach(d => {
        if (!platformStats[d.platform]) {
          platformStats[d.platform] = { count: 0, reach: 0, published: 0 };
        }
        platformStats[d.platform].count++;
        platformStats[d.platform].reach += d.reach;
        if (d.status === 'published') platformStats[d.platform].published++;
      });
    });

    text += `📱 PERFORMANCE PAR PLATEFORME\n`;
    text += `───────────────────────────────────────────────\n`;
    Object.entries(platformStats)
      .sort((a, b) => b[1].reach - a[1].reach)
      .forEach(([platform, stats]) => {
        text += `${platform.toUpperCase()}:\n`;
        text += `  Publications: ${stats.published}/${stats.count}\n`;
        text += `  Reach total: ${stats.reach.toLocaleString()}\n`;
        text += `  Reach moyen: ${stats.published > 0 ? (stats.reach / stats.published).toFixed(0) : '0'} vues/post\n`;
      });
    text += `\n`;

    // Workflow SOP
    text += `📋 WORKFLOW DE RÉPLICATION (SOP)\n`;
    text += `───────────────────────────────────────────────\n`;
    text += `1. Créer le contenu maître\n`;
    text += `   → Vidéo 10-12 min ou article 1500+ mots avec CTA\n`;
    text += `\n`;
    text += `2. Découper & Extraire\n`;
    text += `   → 5-10 clips courts, 6-10 citations, 1 thread, 1 PDF\n`;
    text += `\n`;
    text += `3. Planifier la diffusion\n`;
    text += `   → Calendrier 6 semaines: S1 long-form, S2 thread, S3 ré-up\n`;
    text += `\n`;
    text += `4. Automatiser la publication\n`;
    text += `   → Buffer/Hootsuite pour cross-platform\n`;
    text += `\n`;
    text += `5. Mesurer & Itérer\n`;
    text += `   → Analyser formats qui convertissent le mieux\n`;
    text += `\n`;

    // KPIs à tracker
    text += `🎯 KPIS À TRACKER\n`;
    text += `───────────────────────────────────────────────\n`;
    text += `• Reach par contenu maître: objectif 10,000+\n`;
    text += `• Coût par lead: mesurer ROI du contenu\n`;
    text += `• Taux de réutilisation: objectif 8-10 formats/contenu\n`;
    text += `• Engagement rate par plateforme: benchmark industrie\n`;
    text += `• Conversion rate: contenu → leads → clients\n`;
    text += `\n`;

    text += `═══════════════════════════════════════════════\n`;
    text += `Généré par Money Tracker • ${new Date().toLocaleTimeString('fr-FR')}\n`;

    return text;
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-pink-600 to-purple-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold">🎯 Content Replicator</h2>
              <p className="text-pink-100 text-sm mt-1">Attention is leverage • Multiply reach</p>
            </div>
            <div className="flex items-center gap-3">
              {/* ✅ Bouton Copier */}
              <CopyButton getText={generateCopyText} />
              
              <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-5 text-white">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm opacity-90">Contenus Maîtres</span>
                <FileText className="w-5 h-5" />
              </div>
              <p className="text-3xl font-bold">{totalStats.masterPieces}</p>
            </div>

            <div className="bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl p-5 text-white">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm opacity-90">Déclinaisons</span>
                <Copy className="w-5 h-5" />
              </div>
              <p className="text-3xl font-bold">{totalStats.derivatives}</p>
            </div>

            <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl p-5 text-white">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm opacity-90">Reach Total</span>
                <TrendingUp className="w-5 h-5" />
              </div>
              <p className="text-3xl font-bold">{totalStats.totalReach.toLocaleString()}</p>
            </div>

            <div className="bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl p-5 text-white">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm opacity-90">Engagement Moy.</span>
                <Share2 className="w-5 h-5" />
              </div>
              <p className="text-3xl font-bold">{totalStats.avgEngagement}%</p>
            </div>
          </div>

          {/* Master Content List */}
          <div className="bg-white border rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Contenus Maîtres</h3>
              <button 
                onClick={() => setShowNewContent(true)}
                className="bg-pink-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-pink-700 transition flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Nouveau Contenu</span>
              </button>
            </div>

            <div className="space-y-4">
              {masterContent.map(content => (
                <div 
                  key={content.id}
                  className="border rounded-xl p-5 hover:shadow-lg transition"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className={`p-2 rounded-lg ${
                          content.type === 'video' 
                            ? 'bg-red-100 text-red-600' 
                            : 'bg-blue-100 text-blue-600'
                        }`}>
                          {content.type === 'video' ? <Video className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                        </div>
                        <div>
                          <h4 className="font-bold text-lg text-gray-900">{content.title}</h4>
                          <p className="text-sm text-gray-500">
                            {content.type === 'video' ? '🎥' : '📄'} {content.duration} • 
                            Créé le {new Date(content.createdDate).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-indigo-600">{content.reach.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">reach total</p>
                    </div>
                  </div>

                  {/* Statistiques */}
                  <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Déclinaisons</p>
                      <p className="text-lg font-bold text-gray-900">{content.derivatives.length}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Engagement</p>
                      <p className="text-lg font-bold text-emerald-600">{content.engagement}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Taux réutilisation</p>
                      <p className="text-lg font-bold text-purple-600">
                        {((content.derivatives.length / 10) * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>

                  {/* Déclinaisons */}
                  <div>
                    <h5 className="text-sm font-semibold text-gray-700 mb-3">Déclinaisons par plateforme</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      {content.derivatives.map((derivative, idx) => {
                        const PlatformIcon = platformIcons[derivative.platform] || Share2;
                        return (
                          <div 
                            key={idx}
                            className="flex items-center space-x-3 p-3 bg-white border rounded-lg hover:shadow-md transition"
                          >
                            <div className={`p-2 rounded-lg ${
                              derivative.platform === 'youtube' ? 'bg-red-100 text-red-600' :
                              derivative.platform === 'linkedin' ? 'bg-blue-100 text-blue-600' :
                              derivative.platform === 'twitter' ? 'bg-sky-100 text-sky-600' :
                              derivative.platform === 'instagram' ? 'bg-pink-100 text-pink-600' :
                              'bg-indigo-100 text-indigo-600'
                            }`}>
                              <PlatformIcon className="w-4 h-4" />
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-semibold text-gray-900">{derivative.type}</p>
                              <p className="text-xs text-gray-500">{derivative.reach > 0 ? `${derivative.reach.toLocaleString()} vues` : derivative.status}</p>
                            </div>
                            <div className={`w-2 h-2 rounded-full ${
                              derivative.status === 'published' ? 'bg-emerald-500' :
                              derivative.status === 'scheduled' ? 'bg-orange-500' :
                              'bg-gray-300'
                            }`} />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <button 
                      onClick={() => setSelectedContent(content)}
                      className="text-sm text-indigo-600 font-semibold hover:text-indigo-800 transition"
                    >
                      Voir détails & Analytics
                    </button>
                    <button className="text-sm text-gray-600 font-semibold hover:text-gray-800 transition flex items-center space-x-2">
                      <Download className="w-4 h-4" />
                      <span>Export rapport</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Workflow SOP */}
          <div className="bg-gradient-to-r from-pink-50 to-purple-50 border border-pink-200 rounded-xl p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">📋 Workflow de Réplication (SOP)</h3>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-pink-600 text-white rounded-full flex items-center justify-center font-bold text-sm">1</div>
                <div>
                  <h4 className="font-semibold text-gray-900">Créer le contenu maître</h4>
                  <p className="text-sm text-gray-600">Vidéo 10-12 min ou article long-form (1500+ mots) avec CTA clair</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-pink-600 text-white rounded-full flex items-center justify-center font-bold text-sm">2</div>
                <div>
                  <h4 className="font-semibold text-gray-900">Découper & Extraire</h4>
                  <p className="text-sm text-gray-600">5-10 clips courts, 6-10 citations, 1 thread, 1 PDF, carrousel Instagram</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-pink-600 text-white rounded-full flex items-center justify-center font-bold text-sm">3</div>
                <div>
                  <h4 className="font-semibold text-gray-900">Planifier la diffusion</h4>
                  <p className="text-sm text-gray-600">Calendrier de 6 semaines : S1 long-form + clips, S2 thread + carrousel, S3 ré-up</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-pink-600 text-white rounded-full flex items-center justify-center font-bold text-sm">4</div>
                <div>
                  <h4 className="font-semibold text-gray-900">Automatiser la publication</h4>
                  <p className="text-sm text-gray-600">Buffer / Hootsuite pour planification cross-platform</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-pink-600 text-white rounded-full flex items-center justify-center font-bold text-sm">5</div>
                <div>
                  <h4 className="font-semibold text-gray-900">Mesurer & Itérer</h4>
                  <p className="text-sm text-gray-600">Quel format converti le mieux ? Reproduire ce qui fonctionne</p>
                </div>
              </div>
            </div>
          </div>

          {/* KPIs à tracker */}
          <div className="bg-white border rounded-xl p-6 mt-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">📊 KPIs à tracker</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
                <h4 className="font-semibold text-gray-900 mb-2">Reach par contenu maître</h4>
                <p className="text-sm text-gray-600">Objectif : 10,000+ impressions totales</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-pink-50 to-rose-50 rounded-lg border border-pink-200">
                <h4 className="font-semibold text-gray-900 mb-2">Coût par lead</h4>
                <p className="text-sm text-gray-600">Mesurer ROI du contenu répliqué</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-emerald-50 to-green-50 rounded-lg border border-emerald-200">
                <h4 className="font-semibold text-gray-900 mb-2">Taux de réutilisation</h4>
                <p className="text-sm text-gray-600">Formats produits / contenu maître (objectif: 8-10)</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal détails contenu */}
      {selectedContent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl max-w-3xl w-full p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold">{selectedContent.title}</h3>
              <button onClick={() => setSelectedContent(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Type</p>
                  <p className="font-bold text-gray-900">{selectedContent.type === 'video' ? 'Vidéo' : 'Article'}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Durée</p>
                  <p className="font-bold text-gray-900">{selectedContent.duration}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Reach Total</p>
                  <p className="font-bold text-indigo-600">{selectedContent.reach.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Engagement</p>
                  <p className="font-bold text-emerald-600">{selectedContent.engagement}%</p>
                </div>
              </div>
              
              <div>
                <h4 className="font-bold text-gray-900 mb-3">Performance par plateforme</h4>
                <div className="space-y-2">
                  {selectedContent.derivatives.map((d, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-gray-900">{d.platform} - {d.type}</span>
                      <span className="text-gray-600">{d.reach > 0 ? `${d.reach.toLocaleString()} vues` : d.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
