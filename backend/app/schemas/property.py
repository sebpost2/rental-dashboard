from pydantic import BaseModel, ConfigDict


class PropertyCreate(BaseModel):
    name: str
    address: str
    property_type: str = "apartment"
    currency: str = "USD"


class PropertyUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    property_type: str | None = None
    currency: str | None = None


class PropertyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    address: str
    property_type: str
    currency: str
