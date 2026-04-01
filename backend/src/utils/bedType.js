const ALLOWED_BED_TYPES = ["generalBeds", "icuBeds", "ventilatorBeds"];

const normalizeBedType = (value) => {
  if (!value) return "";
  const map = {
    general: "generalBeds",
    generalbed: "generalBeds",
    generalbeds: "generalBeds",
    icu: "icuBeds",
    icubed: "icuBeds",
    icubeds: "icuBeds",
    ventilator: "ventilatorBeds",
    ventilatorbed: "ventilatorBeds",
    ventilatorbeds: "ventilatorBeds"
  };

  const key = String(value).trim().toLowerCase().replace(/[^a-z]/g, "");
  return map[key] || value;
};

module.exports = {
  ALLOWED_BED_TYPES,
  normalizeBedType
};
