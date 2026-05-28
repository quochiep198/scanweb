import datetime
from sqlalchemy.orm import Session
from app.models.patient import Patient
from app.models.xray_image import XRayImage
from app.models.osteoporosis_label import OsteoporosisLabel

class UploadService:
    @staticmethod
    def register_upload(
        db: Session,
        # patient info
        anonymous_code: str,
        age: int = None,
        sex: str = None,
        height_cm: float = None,
        weight_kg: float = None,
        bmi: float = None,
        # xray image info
        image_path: str = None,
        xray_date: datetime.date = None,
        view_type: str = None,
        body_part: str = None,
        scanner_vendor: str = None,
        pixel_spacing: float = None,
        image_quality: str = None,
        # label info
        label: str = None,
        t_score: float = None,
        bmd: float = None,
        dxa_site: str = None,
        dxa_date: datetime.date = None,
        label_source: str = "DXA",
        # split, source and duplicate control
        dataset_split: str = None,
        source: str = "internal",
        image_hash: str = None
    ):
        # 1. Check if patient exists
        patient = db.query(Patient).filter(Patient.anonymous_code == anonymous_code).first()
        if not patient:
            patient = Patient(
                anonymous_code=anonymous_code,
                age=age,
                sex=sex,
                height_cm=height_cm,
                weight_kg=weight_kg,
                bmi=bmi
            )
            db.add(patient)
            db.flush() # Populate patient_id
        else:
            # Optionally update patient info if provided
            if age is not None: patient.age = age
            if sex is not None: patient.sex = sex
            if height_cm is not None: patient.height_cm = height_cm
            if weight_kg is not None: patient.weight_kg = weight_kg
            if bmi is not None: patient.bmi = bmi
            db.flush()

        # 2. Create XRayImage (saving split, source, and image_hash here)
        xray_image = XRayImage(
            patient_id=patient.patient_id,
            image_path=image_path,
            xray_date=xray_date,
            view_type=view_type,
            body_part=body_part,
            scanner_vendor=scanner_vendor,
            pixel_spacing=pixel_spacing,
            image_quality=image_quality,
            dataset_split=dataset_split,
            source=source,
            image_hash=image_hash,
            is_trained=False
        )
        db.add(xray_image)
        db.flush() # Populate image_id

        # 3. Create OsteoporosisLabel (removed dataset_split from label)
        osteo_label = OsteoporosisLabel(
            image_id=xray_image.image_id,
            label=label,
            t_score=t_score,
            bmd=bmd,
            dxa_site=dxa_site,
            dxa_date=dxa_date,
            label_source=label_source
        )
        db.add(osteo_label)
        
        db.commit()
        return xray_image
