/**
 * Gerador de PIX BRCode — Padrão EMV QR Code (BACEN)
 * Gera o código "copia e cola" do PIX sem nenhum provedor terceiro.
 * Compatível com qualquer banco/app que aceite PIX.
 */

function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

function crc16(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
    crc &= 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export interface PixPayload {
  /** Chave PIX (CPF, email, telefone ou chave aleatória) */
  pixKey: string;
  /** Nome do recebedor (até 25 caracteres) */
  merchantName: string;
  /** Cidade do recebedor (até 15 caracteres) */
  merchantCity: string;
  /** Valor em reais (ex: 0.50) */
  amount: number;
  /** Identificador da transação (até 25 caracteres) */
  txId?: string;
  /** Descrição (opcional) */
  description?: string;
}

export function generatePixBrCode(payload: PixPayload): string {
  const { pixKey, merchantName, merchantCity, amount, txId } = payload;

  // Merchant Account Information (ID 26)
  const gui = tlv("00", "br.gov.bcb.pix");
  const key = tlv("01", pixKey);
  const merchantAccount = tlv("26", gui + key);

  // Build payload
  let brCode = "";
  brCode += tlv("00", "01"); // Payload Format Indicator
  brCode += merchantAccount;
  brCode += tlv("52", "0000"); // Merchant Category Code
  brCode += tlv("53", "986"); // Transaction Currency (BRL)

  if (amount > 0) {
    brCode += tlv("54", amount.toFixed(2));
  }

  brCode += tlv("58", "BR"); // Country Code
  brCode += tlv("59", merchantName.slice(0, 25)); // Merchant Name
  brCode += tlv("60", merchantCity.slice(0, 15)); // Merchant City

  // Additional Data Field (ID 62)
  if (txId) {
    brCode += tlv("62", tlv("05", txId.slice(0, 25)));
  }

  // CRC16 (ID 63) — append "6304" first then calculate
  brCode += "6304";
  const checksum = crc16(brCode);
  brCode += checksum;

  return brCode;
}
