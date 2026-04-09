import type { Inquiry } from '../types/models'
import {
  formatIdrDigitsString,
  formatInquiryDateId,
  formatWeightDisplay,
  inquiryDimensionsLine,
} from '../lib/inquiryFormHelpers'
import { treatmentLabel, vehicleLabel, yesNoId } from '../lib/inquiryServiceOptions'

function AddressDetail({
  label,
  address,
  kel,
  kec,
  kota,
  kode,
}: {
  label: string
  address?: string
  kel?: string
  kec?: string
  kota?: string
  kode?: string
}) {
  const areaLine = [kel, kec, kota].filter((x) => x?.trim()).join(', ')
  const hasContent = address?.trim() || areaLine || kode?.trim()
  if (!hasContent) return null
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      {address?.trim() && <p className="mt-1 text-sm text-slate-800">{address.trim()}</p>}
      {(areaLine || kode?.trim()) && (
        <p className="mt-1 text-sm text-slate-600">
          {areaLine}
          {kode?.trim() ? `${areaLine ? ' · ' : ''}Kode pos ${kode.trim()}` : ''}
        </p>
      )}
    </div>
  )
}

export function InquiryRequestSummary({
  inquiry,
  showImages = true,
}: {
  inquiry: Inquiry
  showImages?: boolean
}) {
  const dimLine = inquiryDimensionsLine(inquiry)

  const hasStructuredOrigin =
    inquiry.pickupAddress?.trim() ||
    inquiry.pickupKelurahan?.trim() ||
    inquiry.pickupKecamatan?.trim() ||
    inquiry.pickupKota?.trim() ||
    inquiry.pickupPostalCode?.trim()
  const hasStructuredDest =
    inquiry.destinationAddress?.trim() ||
    inquiry.destinationKelurahan?.trim() ||
    inquiry.destinationKecamatan?.trim() ||
    inquiry.destinationKota?.trim() ||
    inquiry.destinationPostalCode?.trim()

  return (
    <div className="space-y-2 text-sm text-slate-700">
      <p>
        <span className="font-semibold text-slate-900">Rute (kota):</span> {inquiry.pickup} → {inquiry.destination}
      </p>
      {(hasStructuredOrigin || hasStructuredDest) && (
        <div className="flex flex-col gap-2 pt-1">
          <AddressDetail
            label="Asal penjemputan"
            address={inquiry.pickupAddress}
            kel={inquiry.pickupKelurahan}
            kec={inquiry.pickupKecamatan}
            kota={inquiry.pickupKota}
            kode={inquiry.pickupPostalCode}
          />
          <AddressDetail
            label="Tujuan pengiriman"
            address={inquiry.destinationAddress}
            kel={inquiry.destinationKelurahan}
            kec={inquiry.destinationKecamatan}
            kota={inquiry.destinationKota}
            kode={inquiry.destinationPostalCode}
          />
        </div>
      )}
      <p>
        <span className="font-semibold text-slate-900">Tanggal penjemputan:</span>{' '}
        {formatInquiryDateId(inquiry.scheduledPickupDate)}
      </p>
      <p>
        <span className="font-semibold text-slate-900">Barang:</span> {inquiry.itemDescription}
      </p>
      <p>
        <span className="font-semibold text-slate-900">Koli:</span> {inquiry.koliCount ?? '—'}
      </p>
      <p>
        <span className="font-semibold text-slate-900">Estimasi nilai barang:</span>{' '}
        {formatIdrDigitsString(inquiry.estimatedItemValue ?? '')}
      </p>
      <p>
        <span className="font-semibold text-slate-900">Berat:</span> {formatWeightDisplay(inquiry.weight)}
      </p>
      {dimLine && (
        <p>
          <span className="font-semibold text-slate-900">Dimensi:</span> {dimLine}
        </p>
      )}
      <p>
        <span className="font-semibold text-slate-900">Jenis kendaraan:</span> {vehicleLabel(inquiry.vehicleType)}
      </p>
      <p>
        <span className="font-semibold text-slate-900">Penanganan khusus:</span>{' '}
        {treatmentLabel(inquiry.specialTreatment)}
      </p>
      <p>
        <span className="font-semibold text-slate-900">Asuransi:</span> {yesNoId(inquiry.insurance)}
      </p>
      <p>
        <span className="font-semibold text-slate-900">Packing tambahan:</span> {yesNoId(inquiry.additionalPacking)}
      </p>
      <p>
        <span className="font-semibold text-slate-900">Estimasi budget:</span>{' '}
        {formatIdrDigitsString(inquiry.budgetEstimate ?? '')}
      </p>
      {inquiry.specialRequirements.trim() && (
        <p>
          <span className="font-semibold text-slate-900">Catatan:</span> {inquiry.specialRequirements}
        </p>
      )}
      {showImages && (inquiry.itemImageUrls?.length ?? 0) > 0 && (
        <div className="pt-2">
          <span className="font-semibold text-slate-900">Foto barang:</span>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {inquiry.itemImageUrls!.map((url, i) => (
              <img
                key={i}
                src={url}
                alt=""
                className="aspect-square rounded-lg border border-slate-200 object-cover"
              />
            ))}
          </div>
        </div>
      )}
      {inquiry.tncAcceptedAt && (
        <p className="pt-1 text-xs text-slate-500">
          Persetujuan syarat & ketentuan: {new Date(inquiry.tncAcceptedAt).toLocaleString('id-ID')}
        </p>
      )}
    </div>
  )
}
