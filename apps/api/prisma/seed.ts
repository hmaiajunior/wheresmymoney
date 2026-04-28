import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const systemCategories = [
  { name: 'Alimentação', color: '#22c55e' },
  { name: 'Moradia', color: '#3b82f6' },
  { name: 'Contribuições', color: '#a855f7' },
  { name: 'Educação', color: '#06b6d4' },
  { name: 'Transporte', color: '#f59e0b' },
  { name: 'Refeição', color: '#84cc16' },
  { name: 'PBK', color: '#6366f1' },
  { name: 'Terceiros', color: '#94a3b8' },
  { name: 'Assinaturas', color: '#ec4899' },
  { name: 'Empréstimos', color: '#ef4444' },
  { name: 'Serviços', color: '#0ea5e9' },
  { name: 'Amazon', color: '#f97316' },
  { name: 'Pessoal', color: '#8b5cf6' },
  { name: 'Pet', color: '#d97706' },
  { name: 'Farmácia', color: '#10b981' },
  { name: 'Estudos', color: '#14b8a6' },
  { name: 'Europa-2026', color: '#f43f5e' },
  { name: 'Viagem-Jijoca', color: '#fb923c' },
  { name: 'Impostos', color: '#dc2626' },
];

const paymentMethods = [
  { name: 'PIX', type: 'PIX' },
  { name: 'Débito', type: 'DEBITO' },
  { name: 'Crédito - Itaú', type: 'CREDITO' },
  { name: 'Crédito - Nu', type: 'CREDITO' },
  { name: 'Crédito - Janaína', type: 'CREDITO' },
  { name: 'Boleto', type: 'BOLETO' },
  { name: 'Boleto - Inter', type: 'BOLETO' },
  { name: 'Boleto - Itaú', type: 'BOLETO' },
  { name: 'PIX - Inter', type: 'PIX' },
  { name: 'PIX - Itaú', type: 'PIX' },
  { name: 'PIX - Queline', type: 'PIX' },
  { name: 'Saque - Itaú', type: 'SAQUE' },
  { name: 'Conversão de moeda', type: 'OUTRO' },
];

async function main() {
  console.log('Seeding database...');

  for (const cat of systemCategories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: { ...cat, isSystem: true },
    });
  }
  console.log(`✓ ${systemCategories.length} categorias criadas`);

  for (const pm of paymentMethods) {
    await prisma.paymentMethod.upsert({
      where: { name: pm.name },
      update: {},
      create: pm,
    });
  }
  console.log(`✓ ${paymentMethods.length} formas de pagamento criadas`);

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@wmm.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'changeme';
  const hash = await argon2.hash(adminPassword);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      password: hash,
      name: 'Admin',
      cycleStartDay: 1,
    },
  });
  console.log(`✓ Usuário admin criado (${adminEmail})`);

  console.log('Seed concluído!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
