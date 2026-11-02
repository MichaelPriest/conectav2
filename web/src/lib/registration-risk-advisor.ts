/**
 * Conecta ID 2.0 — explainable risk advisor.
 * This is a rule-based baseline, NOT a trained ML model or verified identity.
 * It never auto-rejects and never grants restricted social access.
 */
import type {TriageSignal} from './registration-risk';
export type RiskBand='low'|'medium'|'high';
export type ReviewRecommendation='basic_eligible'|'human_review'|'additional_evidence';
export type RiskAdvice={
 modelVersion:'rules-v1'; riskBand:RiskBand; recommendation:ReviewRecommendation;
 reasons:TriageSignal[]; confidence:null; trained:false;
};
const high=new Set<TriageSignal>(['document_mismatch','suspected_duplicate','automated_abuse','age_inconsistency']);
const medium=new Set<TriageSignal>(['liveness_inconclusive','manual_report','registration_incomplete']);
export function adviseRegistrationRisk(signals:readonly TriageSignal[],contactConfirmed:boolean):RiskAdvice{
 const reasons=[...new Set(signals)];
 if(reasons.some(x=>high.has(x)))return {modelVersion:'rules-v1',riskBand:'high',recommendation:'human_review',reasons,confidence:null,trained:false};
 if(reasons.some(x=>medium.has(x)))return {modelVersion:'rules-v1',riskBand:'medium',recommendation:'additional_evidence',reasons,confidence:null,trained:false};
 if(!contactConfirmed||reasons.includes('contact_unconfirmed'))return {modelVersion:'rules-v1',riskBand:'medium',recommendation:'additional_evidence',reasons:reasons.includes('contact_unconfirmed')?reasons:[...reasons,'contact_unconfirmed'],confidence:null,trained:false};
 return {modelVersion:'rules-v1',riskBand:'low',recommendation:'basic_eligible',reasons,confidence:null,trained:false};
}
