//! Tests del programa calc-registry con LiteSVM (sin validador local).
//! Cubren los 5 casos de la spec de la Sesión 2:
//! 1. Registro exitoso de un hash nuevo
//! 2. El registro quedó on-chain con los datos correctos
//! 3. Registrar el mismo hash dos veces → falla
//! 4. El evento CalcRegistered se emitió
//! 5. Cinco registros distintos de la misma wallet

use {
    anchor_lang::{
        solana_program::{instruction::Instruction, pubkey::Pubkey},
        AccountDeserialize, AnchorDeserialize, Discriminator, InstructionData, ToAccountMetas,
    },
    base64::{engine::general_purpose::STANDARD as B64, Engine},
    calc_registry::state::{CalcRecord, CalcRegistered},
    litesvm::{types::TransactionMetadata, LiteSVM},
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

fn setup() -> (LiteSVM, Keypair) {
    let mut svm = LiteSVM::new();
    let payer = Keypair::new();
    let bytes = include_bytes!("../../../target/deploy/calc_registry.so");
    svm.add_program(calc_registry::id(), bytes).unwrap();
    svm.airdrop(&payer.pubkey(), 10_000_000_000).unwrap();
    (svm, payer)
}

fn record_pda(wallet: &Pubkey, hash: &[u8; 32]) -> Pubkey {
    Pubkey::find_program_address(
        &[b"calc", wallet.as_ref(), hash.as_ref()],
        &calc_registry::id(),
    )
    .0
}

fn register(
    svm: &mut LiteSVM,
    payer: &Keypair,
    hash: [u8; 32],
) -> Result<TransactionMetadata, Box<dyn std::error::Error>> {
    let pda = record_pda(&payer.pubkey(), &hash);
    let ix = Instruction::new_with_bytes(
        calc_registry::id(),
        &calc_registry::instruction::RegisterCalc { hash }.data(),
        calc_registry::accounts::RegisterCalc {
            record: pda,
            signer: payer.pubkey(),
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    );

    // blockhash fresco por tx: evita el falso positivo de "tx duplicada"
    // cuando dos envíos serían idénticos byte a byte
    svm.expire_blockhash();
    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&[ix], Some(&payer.pubkey()), &blockhash);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[payer])?;

    svm.send_transaction(tx)
        .map_err(|e| format!("{:?}", e.err).into())
}

fn test_hash(n: u8) -> [u8; 32] {
    let mut h = [0u8; 32];
    h[0] = n;
    h[31] = n.wrapping_mul(7);
    h
}

#[test]
fn registro_exitoso_de_hash_nuevo() {
    let (mut svm, payer) = setup();
    let res = register(&mut svm, &payer, test_hash(1));
    assert!(res.is_ok(), "el registro debió ser exitoso: {:?}", res.err());
}

#[test]
fn el_registro_queda_onchain_con_datos_correctos() {
    let (mut svm, payer) = setup();
    let hash = test_hash(2);
    register(&mut svm, &payer, hash).unwrap();

    let pda = record_pda(&payer.pubkey(), &hash);
    let account = svm.get_account(&pda).expect("la PDA debe existir");
    assert_eq!(account.owner, calc_registry::id());

    let record = CalcRecord::try_deserialize(&mut account.data.as_slice()).unwrap();
    assert_eq!(record.hash, hash);
    assert_eq!(record.wallet, payer.pubkey());
    assert!(record.timestamp >= 0);
    assert!(record.bump > 0);
}

#[test]
fn mismo_hash_dos_veces_falla() {
    let (mut svm, payer) = setup();
    let hash = test_hash(3);

    register(&mut svm, &payer, hash).unwrap();
    let segunda = register(&mut svm, &payer, hash);
    assert!(
        segunda.is_err(),
        "registrar el mismo hash dos veces debió fallar"
    );
}

#[test]
fn emite_evento_calc_registered() {
    let (mut svm, payer) = setup();
    let hash = test_hash(4);
    let meta = register(&mut svm, &payer, hash).unwrap();

    let evento = meta
        .logs
        .iter()
        .filter_map(|l| l.strip_prefix("Program data: "))
        .filter_map(|data| B64.decode(data).ok())
        .find(|bytes| bytes.len() > 8 && &bytes[..8] == CalcRegistered::DISCRIMINATOR)
        .expect("debió emitirse el evento CalcRegistered");

    let parsed = CalcRegistered::deserialize(&mut &evento[8..]).unwrap();
    assert_eq!(parsed.hash, hash);
    assert_eq!(parsed.wallet, payer.pubkey());
}

#[test]
fn cinco_registros_distintos_de_la_misma_wallet() {
    let (mut svm, payer) = setup();
    for n in 10..15 {
        let hash = test_hash(n);
        register(&mut svm, &payer, hash)
            .unwrap_or_else(|e| panic!("registro {} falló: {}", n, e));
        assert!(svm.get_account(&record_pda(&payer.pubkey(), &hash)).is_some());
    }
}
