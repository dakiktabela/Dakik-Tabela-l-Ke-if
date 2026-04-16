export type UserRole = 'admin' | 'designer' | 'surveyor' | 'production' | 'installer';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: UserRole;
  companyId?: string;
  createdAt: string;
}

export type ProjectStatus = 
  | 'draft' 
  | 'pending_survey' 
  | 'surveying' 
  | 'survey_completed' 
  | 'design_in_progress' 
  | 'revision' 
  | 'pending_approval' 
  | 'in_production' 
  | 'in_installation' 
  | 'completed';

export interface Project {
  id: string;
  name: string;
  customerId?: string;
  status: ProjectStatus;
  description?: string;
  address?: string;
  assignedTo: string[];
  createdAt: string;
  updatedAt: string;
}

export type SurveyType = 'facade' | 'interior' | 'exterior' | 'vehicle' | 'custom';

export interface Survey {
  id: string;
  projectId: string;
  title: string;
  type: SurveyType;
  mediaUrl?: string;
  canvasData?: string; // JSON string of Konva stage
  notes?: string;
  pixelsPerUnit?: number;
  referenceUnit?: string;
  createdBy: string;
  createdAt: string;
}

export interface CanvasObject {
  id: string;
  type: 'line' | 'rect' | 'ellipse' | 'text' | 'arrow' | 'sticky' | 'pen' | 'measure' | 'polygon' | 'star' | 'angle' | 'icon';
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: number[];
  text?: string;
  fill?: string;
  fillPriority?: 'color' | 'linear-gradient' | 'radial-gradient';
  fillLinearGradientStartPoint?: { x: number; y: number };
  fillLinearGradientEndPoint?: { x: number; y: number };
  fillLinearGradientColorStops?: (number | string)[];
  fillRadialGradientStartPoint?: { x: number; y: number };
  fillRadialGradientStartRadius?: number;
  fillRadialGradientEndPoint?: { x: number; y: number };
  fillRadialGradientEndRadius?: number;
  fillRadialGradientColorStops?: (number | string)[];
  stroke?: string;
  strokeWidth?: number;
  realMeasurement?: string;
  unit?: string;
  isReference?: boolean;
  layer?: string;
  groupId?: string;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  isLocked?: boolean;
  fontSize?: number;
  fontFamily?: string;
  align?: 'left' | 'center' | 'right';
  lineCap?: 'butt' | 'round' | 'square';
  lineJoin?: 'miter' | 'round' | 'bevel';
  visible?: boolean;
  iconType?: string;
}
