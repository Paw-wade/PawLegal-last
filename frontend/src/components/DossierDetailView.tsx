'use client';

import React, { useRef } from 'react';
import jsPDF from 'jspdf';
import { getStatutLabel, getStatutColor, getPrioriteColor, getPrioriteLabel } from '@/lib/dossierUtils';

interface DossierDetailViewProps {
  dossier: any;
  variant?: 'client' | 'admin';
  onDownloadPDF?: () => void;
  onPrint?: () => void;
}

export function DossierDetailView({ dossier, variant = 'client' }: DossierDetailViewProps) {
  const componentRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!componentRef.current) return;

    // Utiliser directement la fonction d'impression du navigateur
    window.print();
  };

  const handleDownloadPDF = () => {
    if (!componentRef.current) return;

    const pdf = new jsPDF('p', 'mm', 'a4');
    const element = componentRef.current;
    
    // Créer un clone de l'élément pour le traitement
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Styles pour le PDF
    const styles = `
      <style>
        body {
          font-family: Arial, sans-serif;
          font-size: 12px;
          line-height: 1.6;
          color: #333;
          padding: 20px;
        }
        h1 {
          font-size: 24px;
          color: #f97316;
          margin-bottom: 10px;
          border-bottom: 2px solid #f97316;
          padding-bottom: 10px;
        }
        h2 {
          font-size: 18px;
          color: #333;
          margin-top: 20px;
          margin-bottom: 10px;
          border-bottom: 1px solid #ddd;
          padding-bottom: 5px;
        }
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin: 15px 0;
        }
        .info-item {
          margin-bottom: 10px;
        }
        .info-label {
          font-weight: bold;
          color: #666;
          font-size: 11px;
          text-transform: uppercase;
          margin-bottom: 3px;
        }
        .info-value {
          font-size: 12px;
          color: #333;
        }
        .badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          margin-right: 8px;
          margin-bottom: 8px;
        }
        .description {
          background: #f9fafb;
          padding: 15px;
          border-radius: 8px;
          margin: 15px 0;
          white-space: pre-wrap;
        }
        .section {
          margin-bottom: 25px;
          page-break-inside: avoid;
        }
        .header-info {
          background: #fff7ed;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 15px 0;
        }
        table th, table td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }
        table th {
          background: #f9fafb;
          font-weight: bold;
        }
      </style>
    `;

    const content = element.innerHTML;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Dossier ${dossier.numero || dossier._id}</title>
          ${styles}
        </head>
        <body>
          ${content}
        </body>
      </html>
    `);
    printWindow.document.close();

    // Utiliser html2canvas pour convertir en image puis en PDF
    // Attendre que le contenu de la fenêtre soit chargé
    printWindow.onload = () => {
      setTimeout(() => {
        import('html2canvas').then((html2canvas) => {
          // Capturer le body de la fenêtre d'impression au lieu de l'élément original
          const bodyElement = printWindow.document.body;
          
          html2canvas.default(bodyElement, {
            scale: 2,
            useCORS: true,
            logging: false,
            allowTaint: false, // Ne pas permettre taint pour éviter les problèmes CORS
            backgroundColor: '#ffffff',
            removeContainer: false,
            onclone: (clonedDoc: Document) => {
              // S'assurer que toutes les images sont chargées dans le clone
              const images = clonedDoc.querySelectorAll('img');
              const imagePromises: Promise<void>[] = [];
              
              images.forEach((img: HTMLImageElement) => {
                if (!img.complete || img.naturalHeight === 0) {
                  const promise = new Promise<void>((resolve) => {
                    img.onload = () => resolve();
                    img.onerror = () => {
                      img.style.display = 'none';
                      resolve();
                    };
                    // Si l'image ne charge pas dans 2 secondes, la masquer
                    setTimeout(() => {
                      img.style.display = 'none';
                      resolve();
                    }, 2000);
                  });
                  imagePromises.push(promise);
                }
              });
              
              return Promise.all(imagePromises).then(() => {});
            }
          }).then((canvas) => {
            try {
              // Vérifier que le canvas est valide
              if (!canvas || canvas.width === 0 || canvas.height === 0) {
                throw new Error('Le canvas est vide ou invalide');
              }

              // Convertir le canvas en blob puis en data URL pour éviter les problèmes de signature
              canvas.toBlob((blob: Blob | null) => {
                if (!blob) {
                  throw new Error('Impossible de convertir le canvas en blob');
                }

                const reader = new FileReader();
                reader.onloadend = () => {
                  try {
                    const imgData = reader.result as string;
                    
                    // Vérifier que imgData est valide
                    if (!imgData || typeof imgData !== 'string' || !imgData.startsWith('data:image/')) {
                      throw new Error('Les données de l\'image sont invalides');
                    }

                    // Créer l'instance PDF
                    const pdf = new jsPDF('p', 'mm', 'a4');
                    const imgWidth = 210; // A4 width in mm
                    const pageHeight = 297; // A4 height in mm
                    const imgHeight = (canvas.height * imgWidth) / canvas.width;
                    let heightLeft = imgHeight;

                    let position = 0;

                    // Ajouter la première page avec l'image
                    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                    heightLeft -= pageHeight;

                    // Ajouter des pages supplémentaires si nécessaire
                    while (heightLeft >= 0) {
                      position = heightLeft - imgHeight;
                      pdf.addPage();
                      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                      heightLeft -= pageHeight;
                    }

                    pdf.save(`Dossier_${dossier.numero || dossier._id}_${new Date().toISOString().split('T')[0]}.pdf`);
                    printWindow.close();
                  } catch (error: any) {
                    console.error('Erreur lors de la génération du PDF:', error);
                    alert(`Erreur lors de la génération du PDF: ${error.message || 'Erreur inconnue'}`);
                    printWindow.close();
                  }
                };
                reader.onerror = () => {
                  throw new Error('Erreur lors de la lecture du blob');
                };
                reader.readAsDataURL(blob);
              }, 'image/png', 1.0);
            } catch (error: any) {
              console.error('Erreur lors de la génération du PDF:', error);
              alert(`Erreur lors de la génération du PDF: ${error.message || 'Erreur inconnue'}`);
              printWindow.close();
            }
          }).catch((error: any) => {
            console.error('Erreur lors de la conversion HTML en canvas:', error);
            alert(`Erreur lors de la conversion: ${error.message || 'Erreur inconnue'}`);
            printWindow.close();
          });
        }).catch((error: any) => {
          console.error('Erreur lors du chargement de html2canvas:', error);
          alert('Erreur lors du chargement de la bibliothèque de conversion');
          printWindow.close();
        });
      }, 1000); // Attendre que le contenu soit chargé
    };
  };

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Parser la description pour extraire les informations spécifiques
  const parseDescription = (description: string) => {
    if (!description) return { mainDescription: '', specificFields: [] };
    
    const parts = description.split('--- Informations spécifiques ---');
    const mainDescription = parts[0]?.trim() || '';
    const specificSection = parts[1]?.trim() || '';
    
    const specificFields: Array<{ label: string; value: string }> = [];
    if (specificSection) {
      const lines = specificSection.split('\n');
      lines.forEach(line => {
        const match = line.match(/^(.+?):\s*(.+)$/);
        if (match) {
          specificFields.push({ label: match[1].trim(), value: match[2].trim() });
        }
      });
    }
    
    return { mainDescription, specificFields };
  };

  const { mainDescription, specificFields } = parseDescription(dossier.description || '');

  return (
    <div className="space-y-6">
      {/* Icône PDF avec actions - visible sur la page */}
      <div className="bg-white rounded-lg shadow-md p-6 border-2 border-dashed border-primary/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-red-100 rounded-lg flex items-center justify-center">
              <span className="text-4xl">📄</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                Récapitulatif du dossier
              </h3>
              <p className="text-sm text-muted-foreground">
                Téléchargez ou imprimez le récapitulatif complet de votre dossier
              </p>
              {dossier.numero && (
                <p className="text-xs text-muted-foreground mt-1">
                  Numéro: <span className="font-semibold">{dossier.numero}</span>
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors shadow-sm"
              title="Imprimer le récapitulatif"
            >
              <span>🖨️</span>
              Imprimer
            </button>
            <button
              onClick={handleDownloadPDF}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-sm"
              title="Télécharger le récapitulatif en PDF"
            >
              <span>📥</span>
              Télécharger PDF
            </button>
          </div>
        </div>
      </div>

      {/* Contenu du dossier - CACHÉ mais présent dans le DOM pour impression/PDF */}
      <div
        ref={componentRef}
        className="hidden"
        style={{ maxWidth: '210mm', margin: '0 auto' }}
      >
        {/* En-tête */}
        <div className="mb-8 pb-6 border-b-2 border-primary">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-primary mb-2">
                {dossier.titre}
              </h1>
              {dossier.numero && (
                <p className="text-sm text-muted-foreground">
                  Numéro de dossier: <span className="font-semibold">{dossier.numero}</span>
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">
                Généré le {new Date().toLocaleDateString('fr-FR')}
              </p>
            </div>
          </div>

          {/* Badges de statut */}
          <div className="flex flex-wrap gap-2 mt-4">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatutColor(dossier.statut)}`}>
              Statut: {getStatutLabel(dossier.statut)}
            </span>
            {dossier.priorite && (
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPrioriteColor(dossier.priorite)}`}>
                Priorité: {getPrioriteLabel(dossier.priorite)}
              </span>
            )}
            {dossier.categorie && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                Catégorie: {dossier.categorie.replace(/_/g, ' ')}
              </span>
            )}
          </div>
        </div>

        {/* Informations générales */}
        <div className="section mb-6">
          <h2 className="text-xl font-bold mb-4 text-foreground border-b pb-2">
            Informations Générales
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="info-item">
              <p className="info-label">Numéro de dossier</p>
              <p className="info-value font-semibold">{dossier.numero || dossier._id || 'N/A'}</p>
            </div>
            <div className="info-item">
              <p className="info-label">Type de demande</p>
              <p className="info-value">{dossier.type || 'Non spécifié'}</p>
            </div>
            <div className="info-item">
              <p className="info-label">Date de création</p>
              <p className="info-value">{formatDate(dossier.createdAt)}</p>
            </div>
            <div className="info-item">
              <p className="info-label">Dernière mise à jour</p>
              <p className="info-value">{formatDate(dossier.updatedAt || dossier.createdAt)}</p>
            </div>
            {dossier.dateEcheance && (
              <div className="info-item">
                <p className="info-label">Date d'échéance</p>
                <p className="info-value font-semibold text-orange-600">
                  {formatDate(dossier.dateEcheance)}
                </p>
              </div>
            )}
            {dossier.assignedTo && (
              <div className="info-item">
                <p className="info-label">Assigné à</p>
                <p className="info-value">
                  {dossier.assignedTo.firstName} {dossier.assignedTo.lastName}
                  {dossier.assignedTo.email && ` (${dossier.assignedTo.email})`}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Informations client */}
        <div className="section mb-6">
          <h2 className="text-xl font-bold mb-4 text-foreground border-b pb-2">
            Informations Client
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {dossier.user ? (
              <>
                <div className="info-item">
                  <p className="info-label">Nom complet</p>
                  <p className="info-value">
                    {dossier.user.firstName} {dossier.user.lastName}
                  </p>
                </div>
                <div className="info-item">
                  <p className="info-label">Email</p>
                  <p className="info-value">{dossier.user.email || 'N/A'}</p>
                </div>
                {dossier.user.phone && (
                  <div className="info-item">
                    <p className="info-label">Téléphone</p>
                    <p className="info-value">{dossier.user.phone}</p>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="info-item">
                  <p className="info-label">Nom complet</p>
                  <p className="info-value">
                    {dossier.clientPrenom} {dossier.clientNom}
                  </p>
                </div>
                <div className="info-item">
                  <p className="info-label">Email</p>
                  <p className="info-value">{dossier.clientEmail || 'N/A'}</p>
                </div>
                {dossier.clientTelephone && (
                  <div className="info-item">
                    <p className="info-label">Téléphone</p>
                    <p className="info-value">{dossier.clientTelephone}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Description principale */}
        {mainDescription && (
          <div className="section mb-6">
            <h2 className="text-xl font-bold mb-4 text-foreground border-b pb-2">
              Description
            </h2>
            <div className="description bg-gray-50 p-4 rounded-lg">
              <p className="whitespace-pre-wrap text-foreground">{mainDescription}</p>
            </div>
          </div>
        )}

        {/* Informations spécifiques */}
        {specificFields.length > 0 && (
          <div className="section mb-6">
            <h2 className="text-xl font-bold mb-4 text-foreground border-b pb-2">
              Informations Spécifiques à la Demande
            </h2>
            <div className="bg-gray-50 p-4 rounded-lg">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left p-2">Champ</th>
                    <th className="text-left p-2">Valeur</th>
                  </tr>
                </thead>
                <tbody>
                  {specificFields.map((field, index) => (
                    <tr key={index} className="border-b">
                      <td className="p-2 font-semibold">{field.label}</td>
                      <td className="p-2">{field.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Documents associés */}
        {dossier.documents && dossier.documents.length > 0 && (
          <div className="section mb-6">
            <h2 className="text-xl font-bold mb-4 text-foreground border-b pb-2">
              Documents Associés ({dossier.documents.length})
            </h2>
            <div className="bg-gray-50 p-4 rounded-lg">
              <ul className="list-disc list-inside space-y-2">
                {dossier.documents.map((doc: any, index: number) => (
                  <li key={index} className="text-foreground">
                    {doc.nomFichier || doc.filename || `Document ${index + 1}`}
                    {doc.url && (
                      <span className="text-xs text-muted-foreground ml-2">
                        ({doc.url})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Messages */}
        {dossier.messages && dossier.messages.length > 0 && (
          <div className="section mb-6">
            <h2 className="text-xl font-bold mb-4 text-foreground border-b pb-2">
              Messages ({dossier.messages.length})
            </h2>
            <div className="space-y-4">
              {dossier.messages.map((msg: any, index: number) => (
                <div key={index} className="bg-gray-50 p-4 rounded-lg border-l-4 border-primary">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-foreground">{msg.sujet || `Message ${index + 1}`}</h3>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(msg.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{msg.message}</p>
                  {msg.expediteur && (
                    <p className="text-xs text-muted-foreground mt-2">
                      De: {msg.expediteur.email || 'N/A'}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes administratives */}
        {dossier.notes && (
          <div className="section mb-6">
            <h2 className="text-xl font-bold mb-4 text-foreground border-b pb-2">
              Notes Administratives
            </h2>
            <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-400">
              <p className="whitespace-pre-wrap text-foreground">{dossier.notes}</p>
            </div>
          </div>
        )}

        {/* Motif de refus */}
        {dossier.motifRefus && (
          <div className="section mb-6">
            <h2 className="text-xl font-bold mb-4 text-red-600 border-b border-red-200 pb-2">
              Motif de Refus
            </h2>
            <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-400">
              <p className="whitespace-pre-wrap text-foreground">{dossier.motifRefus}</p>
            </div>
          </div>
        )}

        {/* Pied de page */}
        <div className="mt-8 pt-6 border-t text-center text-xs text-muted-foreground">
          <p>Document généré automatiquement par Paw Legal</p>
          <p>Ce document est confidentiel et destiné uniquement au client concerné</p>
        </div>
      </div>
    </div>
  );
}

