import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';

import Button from '@/components/ui/Button';
import Screen from '@/components/ui/Screen';
import BottomSheet from '@/components/ui/BottomSheet';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiRequest, apiUpload } from '@/lib/api/client';
import type { VetDocument, DogSummary, VetDocumentAnalysis } from '@/lib/api/types';

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return 'Unknown date';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const DOC_TYPE_OPTIONS = [
  { value: 'general', label: 'General Visit' },
  { value: 'bloodwork', label: 'Bloodwork/Labs' },
  { value: 'ultrasound', label: 'Ultrasound/Imaging' },
  { value: 'surgery', label: 'Surgery' },
  { value: 'dental', label: 'Dental' },
  { value: 'vaccination', label: 'Vaccinations' },
  { value: 'other', label: 'Other' },
];

export default function WellnessVetDocsScreen() {
  const { session } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  const [documents, setDocuments] = useState<VetDocument[]>([]);
  const [dogs, setDogs] = useState<DogSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<VetDocument | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!session?.token) return;
    setLoading(true);
    setError(null);
    try {
      const [docsPayload, dogsPayload] = await Promise.all([
        apiRequest<{ documents: VetDocument[] }>('/api/mobile/customer/vet-documents', {
          token: session.token,
        }),
        apiRequest<{ dogs: DogSummary[] }>('/api/mobile/customer/dogs', {
          token: session.token,
        }),
      ]);
      setDocuments(docsPayload.documents ?? []);
      setDogs(dogsPayload.dogs ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load documents.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [session?.token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleUpload = async () => {
    if (!session?.token) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const file = result.assets[0];
      setUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: 'application/pdf',
      } as any);
      formData.append('metadata', JSON.stringify({
        documentName: file.name.replace('.pdf', ''),
        documentType: 'general',
      }));

      await apiUpload('/api/mobile/customer/vet-documents', {
        method: 'POST',
        token: session.token,
        body: formData,
      });

      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload document.';
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  const handleOpenDoc = (doc: VetDocument) => {
    setSelectedDoc(doc);
    setDetailSheetOpen(true);
  };

  const handleViewPDF = async () => {
    if (!selectedDoc?.documentUrl) return;
    await Linking.openURL(selectedDoc.documentUrl);
  };

  const getStatusColor = (status: VetDocument['analysisStatus']) => {
    switch (status) {
      case 'COMPLETED':
        return Colors.brand.mint;
      case 'PROCESSING':
        return Colors.brand.gold;
      case 'FAILED':
        return palette.danger;
      default:
        return palette.muted;
    }
  };

  const getStatusLabel = (status: VetDocument['analysisStatus']) => {
    switch (status) {
      case 'COMPLETED':
        return 'Analyzed';
      case 'PROCESSING':
        return 'Analyzing...';
      case 'FAILED':
        return 'Analysis failed';
      default:
        return 'Pending';
    }
  };

  const analysis = selectedDoc?.analysis as VetDocumentAnalysis | null | undefined;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={palette.tint} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <FontAwesome name="chevron-left" size={16} color={palette.text} />
          </Pressable>
          <Text style={[styles.kicker, { color: palette.muted }]}>WELLNESS TOOLS</Text>
          <Text style={[styles.title, { color: palette.text }]}>Vet Documents</Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>
            Upload vet records and let AI extract key insights
          </Text>
        </View>

        {/* Upload Card */}
        <Pressable
          onPress={handleUpload}
          disabled={uploading}
          style={({ pressed }) => [
            styles.uploadCard,
            { backgroundColor: `${palette.tint}10`, borderColor: palette.tint, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <View style={[styles.uploadIconWrap, { backgroundColor: `${palette.tint}20` }]}>
            {uploading ? (
              <ActivityIndicator size="small" color={palette.tint} />
            ) : (
              <FontAwesome name="cloud-upload" size={24} color={palette.tint} />
            )}
          </View>
          <View style={styles.uploadText}>
            <Text style={[styles.uploadTitle, { color: palette.text }]}>
              {uploading ? 'Uploading...' : 'Upload Vet Document'}
            </Text>
            <Text style={[styles.uploadDesc, { color: palette.muted }]}>
              PDF files only. AI will analyze the content.
            </Text>
          </View>
          <FontAwesome name="chevron-right" size={14} color={palette.muted} />
        </Pressable>

        {error ? (
          <View style={[styles.errorCard, { backgroundColor: `${palette.danger}10`, borderColor: palette.danger }]}>
            <FontAwesome name="exclamation-circle" size={14} color={palette.danger} />
            <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
          </View>
        ) : null}

        {loading && documents.length === 0 ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={palette.tint} />
            <Text style={[styles.loadingText, { color: palette.muted }]}>Loading documents...</Text>
          </View>
        ) : documents.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <FontAwesome name="file-text-o" size={32} color={palette.muted} />
            <Text style={[styles.emptyTitle, { color: palette.text }]}>No documents yet</Text>
            <Text style={[styles.emptyDesc, { color: palette.muted }]}>
              Upload your first vet document to get AI-powered insights.
            </Text>
          </View>
        ) : (
          <View style={styles.docsSection}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Your Documents</Text>
            {documents.map((doc) => (
              <Pressable
                key={doc.id}
                onPress={() => handleOpenDoc(doc)}
                style={({ pressed }) => [
                  styles.docCard,
                  { backgroundColor: palette.card, borderColor: palette.border, opacity: pressed ? 0.9 : 1 },
                ]}
              >
                <View style={[styles.docIcon, { backgroundColor: `${palette.tint}15` }]}>
                  <FontAwesome name="file-pdf-o" size={20} color={palette.tint} />
                </View>
                <View style={styles.docInfo}>
                  <Text style={[styles.docName, { color: palette.text }]} numberOfLines={1}>
                    {doc.documentName}
                  </Text>
                  <View style={styles.docMeta}>
                    {doc.dog ? (
                      <Text style={[styles.docMetaText, { color: palette.muted }]}>{doc.dog.name}</Text>
                    ) : null}
                    <Text style={[styles.docMetaText, { color: palette.muted }]}>
                      {formatDate(doc.visitDate || doc.createdAt)}
                    </Text>
                  </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(doc.analysisStatus)}20` }]}>
                  <View style={[styles.statusDot, { backgroundColor: getStatusColor(doc.analysisStatus) }]} />
                  <Text style={[styles.statusText, { color: getStatusColor(doc.analysisStatus) }]}>
                    {getStatusLabel(doc.analysisStatus)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Document Detail Sheet */}
      <BottomSheet visible={detailSheetOpen} onClose={() => setDetailSheetOpen(false)} snapPoints={[0.85]}>
        {selectedDoc && (
          <ScrollView contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
            <View style={styles.detailHeader}>
              <View style={[styles.detailIcon, { backgroundColor: `${palette.tint}15` }]}>
                <FontAwesome name="file-pdf-o" size={24} color={palette.tint} />
              </View>
              <Text style={[styles.detailTitle, { color: palette.text }]}>{selectedDoc.documentName}</Text>
              <Text style={[styles.detailDate, { color: palette.muted }]}>
                {formatDate(selectedDoc.visitDate || selectedDoc.createdAt)}
              </Text>
            </View>

            <Button title="View Original PDF" onPress={handleViewPDF} variant="secondary" style={styles.pdfButton} />

            {selectedDoc.analysisStatus === 'PROCESSING' ? (
              <View style={[styles.processingCard, { backgroundColor: `${Colors.brand.gold}10`, borderColor: Colors.brand.gold }]}>
                <ActivityIndicator size="small" color={Colors.brand.gold} />
                <Text style={[styles.processingText, { color: Colors.brand.gold }]}>
                  AI is analyzing this document...
                </Text>
              </View>
            ) : selectedDoc.analysisStatus === 'FAILED' ? (
              <View style={[styles.errorCard, { backgroundColor: `${palette.danger}10`, borderColor: palette.danger }]}>
                <FontAwesome name="exclamation-circle" size={14} color={palette.danger} />
                <Text style={[styles.errorText, { color: palette.danger }]}>
                  {selectedDoc.analysisError || 'Analysis failed'}
                </Text>
              </View>
            ) : analysis ? (
              <View style={styles.analysisSection}>
                {/* Case Summary */}
                {analysis.caseSummary ? (
                  <View style={[styles.analysisCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
                    <Text style={[styles.analysisLabel, { color: palette.muted }]}>Case Summary</Text>
                    <Text style={[styles.analysisText, { color: palette.text }]}>{analysis.caseSummary}</Text>
                  </View>
                ) : null}

                {/* Problem List */}
                {analysis.problemList?.length ? (
                  <View style={[styles.analysisCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
                    <Text style={[styles.analysisLabel, { color: palette.muted }]}>Problems Identified</Text>
                    {analysis.problemList.map((problem, i) => (
                      <View key={i} style={styles.listItem}>
                        <View style={[styles.listBullet, { backgroundColor: Colors.brand.coral }]} />
                        <Text style={[styles.listText, { color: palette.text }]}>{problem}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {/* Diagnostics */}
                {analysis.diagnostics?.length ? (
                  <View style={[styles.analysisCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
                    <Text style={[styles.analysisLabel, { color: palette.muted }]}>Diagnostic Findings</Text>
                    {analysis.diagnostics.map((diag, i) => (
                      <View key={i} style={styles.diagItem}>
                        {diag.system ? (
                          <Text style={[styles.diagSystem, { color: palette.tint }]}>{diag.system}</Text>
                        ) : null}
                        <Text style={[styles.diagFinding, { color: palette.text }]}>{diag.finding}</Text>
                        {diag.severity ? (
                          <Text style={[styles.diagSeverity, { color: palette.muted }]}>Severity: {diag.severity}</Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                ) : null}

                {/* Medications */}
                {analysis.medications?.length ? (
                  <View style={[styles.analysisCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
                    <Text style={[styles.analysisLabel, { color: palette.muted }]}>Medications</Text>
                    {analysis.medications.map((med, i) => (
                      <View key={i} style={styles.medItem}>
                        <Text style={[styles.medName, { color: palette.text }]}>{med.name}</Text>
                        {med.dosage || med.frequency ? (
                          <Text style={[styles.medDetail, { color: palette.muted }]}>
                            {[med.dosage, med.frequency, med.duration].filter(Boolean).join(' | ')}
                          </Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                ) : null}

                {/* At Home Care */}
                {analysis.atHomeCare?.length ? (
                  <View style={[styles.analysisCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
                    <Text style={[styles.analysisLabel, { color: palette.muted }]}>At-Home Care Instructions</Text>
                    {analysis.atHomeCare.map((instruction, i) => (
                      <View key={i} style={styles.listItem}>
                        <View style={[styles.listBullet, { backgroundColor: Colors.brand.mint }]} />
                        <Text style={[styles.listText, { color: palette.text }]}>{instruction}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {/* Follow Up */}
                {analysis.followUp?.watchFor?.length ? (
                  <View style={[styles.analysisCard, { backgroundColor: `${Colors.brand.gold}10`, borderColor: Colors.brand.gold }]}>
                    <Text style={[styles.analysisLabel, { color: Colors.brand.gold }]}>Watch For</Text>
                    {analysis.followUp.watchFor.map((warning, i) => (
                      <View key={i} style={styles.listItem}>
                        <FontAwesome name="exclamation-triangle" size={12} color={Colors.brand.gold} />
                        <Text style={[styles.listText, { color: palette.text, marginLeft: 8 }]}>{warning}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {/* Raw Findings */}
                {analysis.rawFindings && !analysis.caseSummary ? (
                  <View style={[styles.analysisCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
                    <Text style={[styles.analysisLabel, { color: palette.muted }]}>Extracted Information</Text>
                    <Text style={[styles.analysisText, { color: palette.text }]}>{analysis.rawFindings}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </ScrollView>
        )}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    gap: 4,
    marginBottom: 20,
  },
  backButton: {
    marginBottom: 8,
    padding: 4,
    alignSelf: 'flex-start',
  },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  uploadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 16,
    marginBottom: 16,
  },
  uploadIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: {
    flex: 1,
    gap: 2,
  },
  uploadTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  uploadDesc: {
    fontSize: 12,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
  },
  loadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
  },
  loadingText: {
    fontSize: 13,
  },
  emptyCard: {
    alignItems: 'center',
    padding: 32,
    borderWidth: 1,
    borderRadius: 16,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyDesc: {
    fontSize: 13,
    textAlign: 'center',
  },
  docsSection: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderRadius: 14,
  },
  docIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docInfo: {
    flex: 1,
    gap: 4,
  },
  docName: {
    fontSize: 14,
    fontWeight: '600',
  },
  docMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  docMetaText: {
    fontSize: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  detailContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 16,
  },
  detailHeader: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  detailIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  detailDate: {
    fontSize: 13,
  },
  pdfButton: {
    marginTop: 8,
  },
  processingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 16,
    borderWidth: 1,
    borderRadius: 12,
  },
  processingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  analysisSection: {
    gap: 12,
    marginTop: 8,
  },
  analysisCard: {
    padding: 14,
    borderWidth: 1,
    borderRadius: 14,
    gap: 8,
  },
  analysisLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  analysisText: {
    fontSize: 14,
    lineHeight: 20,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  listBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  listText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  diagItem: {
    gap: 4,
    paddingVertical: 6,
  },
  diagSystem: {
    fontSize: 12,
    fontWeight: '600',
  },
  diagFinding: {
    fontSize: 14,
  },
  diagSeverity: {
    fontSize: 12,
  },
  medItem: {
    paddingVertical: 6,
    gap: 2,
  },
  medName: {
    fontSize: 14,
    fontWeight: '600',
  },
  medDetail: {
    fontSize: 12,
  },
});
